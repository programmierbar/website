import { defineHook } from '@directus/extensions-sdk'
import axios from 'axios'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { postSlackMessage } from './../shared/postSlackMessage.ts'

const HOOK_NAME = 'deploy-website'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    /**
     * It deploys our website on created items, if necessary.
     */
    action('items.create', ({ payload, ...metadata }, context) =>
        handleAction('create', { payload, metadata, context })
    )

    /**
     * It deploys our website on updated items, if necessary.
     */
    action('items.update', ({ payload, ...metadata }, context) =>
        handleAction('update', { payload, metadata, context })
    )

    async function handleAction(
        type: string,
        {
            payload,
            metadata,
            context,
        }: {
            payload: any
            metadata: Record<string, any>
            context: any
        }
    ) {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start "${metadata.collection}" action function`)

            // Get fields of collection
            const { fields } = context.schema.collections[metadata.collection]

            // Deploy website only if status field exists
            if (!fields.status) {
                return
            }

            // Create items service instance
            const itemsService = new ItemsService(metadata.collection, {
                accountability: context.accountability,
                schema: context.schema,
            })

            // Get item from item service by key
            const item = await itemsService.readOne(metadata.key || metadata.keys[0])

            // Deploy website only if it is a published item or
            // action type is "update" and status has changed
            const contentUpdateRelevant = item.status === 'published' || (type === 'update' && payload.status)

            if (!contentUpdateRelevant) {
                return
            }

            await axios({
                method: 'POST',
                url: env.VERCEL_DEPLOY_WEBHOOK_URL,
            })
        } catch (error: any) {
            try {
                await postSlackMessage(
                    `:warning: *${HOOK_NAME} hook*: Die Website konnte nicht automatisch deployed werden. Error: ${error.message}`
                )
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME} hook: Error: Could not post message to Slack: ${slackError.message}`)
            }

            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }
    }
})
