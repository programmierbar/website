import { defineHook } from '@directus/extensions-sdk'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import {
    buildRelationFields,
    CascadeRelation,
    extractDraftIds,
    extractParentKeys,
    isPublishPayload,
} from './util/cascadePublish.ts'

const HOOK_NAME = 'cascade-publish'

const PODCAST_RELATIONS: CascadeRelation[] = [
    {
        relationField: 'speakers',
        childField: 'speaker',
        targetCollection: 'speakers',
    },
    {
        relationField: 'picks_of_the_day',
        targetCollection: 'picks_of_the_day',
    },
]

const MEETUP_RELATIONS: CascadeRelation[] = [
    {
        relationField: 'speakers',
        childField: 'speaker',
        targetCollection: 'speakers',
    },
    {
        relationField: 'talks',
        childField: 'talk',
        targetCollection: 'talks',
    },
]

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema
    const env = hookContext.env

    action('podcasts.items.create', async (metadata, eventContext) => {
        await handlePublishAction('podcasts', metadata, PODCAST_RELATIONS, eventContext)
    })

    action('podcasts.items.update', async (metadata, eventContext) => {
        await handlePublishAction('podcasts', metadata, PODCAST_RELATIONS, eventContext)
    })

    action('meetups.items.create', async (metadata, eventContext) => {
        await handlePublishAction('meetups', metadata, MEETUP_RELATIONS, eventContext)
    })

    action('meetups.items.update', async (metadata, eventContext) => {
        await handlePublishAction('meetups', metadata, MEETUP_RELATIONS, eventContext)
    })

    async function handlePublishAction(
        parentCollection: string,
        metadata: Record<string, any>,
        relations: CascadeRelation[],
        eventContext: Record<string, any>
    ) {
        if (!isPublishPayload(metadata.payload)) {
            return
        }

        const parentKeys = extractParentKeys(metadata)
        if (parentKeys.length === 0) {
            logger.warn(`${HOOK_NAME}: No key found for ${parentCollection} action`)
            return
        }

        const schema = await getSchema()

        for (const parentKey of parentKeys) {
            logger.info(`${HOOK_NAME}: ${parentCollection} ${parentKey} published, cascading to related items`)

            // Build the fields list for reading the parent with all its relations
            const fields = buildRelationFields(relations)

            // Read the parent item with nested relation data
            const parentService = new ItemsService(parentCollection, {
                schema,
                accountability: eventContext.accountability,
            })
            const parentItem = await parentService.readOne(parentKey, { fields })

            const errors: Error[] = []

            for (const relation of relations) {
                try {
                    await cascadePublishRelation(schema, parentItem, relation, eventContext)
                } catch (error: any) {
                    logger.error(
                        `${HOOK_NAME}: Failed to cascade ${relation.targetCollection} for ${parentCollection} ${parentKey}: ${error.message}`
                    )
                    errors.push(error)
                }
            }

            if (errors.length > 0) {
                try {
                    await postSlackMessage(
                        `:warning: *${HOOK_NAME}*: Fehler beim automatischen Veröffentlichen von verknüpften Einträgen für ${parentCollection} ${parentKey}.\n` +
                            `Fehler: ${errors.map((e) => e.message).join(', ')}\n` +
                            `${env.PUBLIC_URL}admin/content/${parentCollection}/${parentKey}`
                    )
                } catch (slackError: any) {
                    logger.error(`${HOOK_NAME}: Failed to send Slack notification: ${slackError.message}`)
                }
            }
        }
    }

    async function cascadePublishRelation(schema: any, parentItem: any, relation: CascadeRelation, eventContext: Record<string, any>) {
        const draftIds = extractDraftIds(parentItem, relation)

        if (draftIds.length === 0) {
            logger.info(`${HOOK_NAME}: No draft ${relation.targetCollection} items to publish`)
            return
        }

        const targetService = new ItemsService(relation.targetCollection, {
            schema,
            accountability: eventContext.accountability,
        })
        await targetService.updateMany(draftIds, { status: 'published' })

        logger.info(
            `${HOOK_NAME}: Published ${draftIds.length} ${relation.targetCollection} item(s): ${draftIds.join(', ')}`
        )
    }

    logger.info(`${HOOK_NAME} hook registered`)
})
