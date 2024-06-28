import { Buffer } from 'buffer'
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineHook } from '@directus/extensions-sdk'
import { default as axios } from 'axios'
// @ts-ignore
import { getUrlSlug } from '../../../../../shared-code/index.ts'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'

// Ignoring error here because IDE does not pick up right configuration
// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const HOOK_NAME = 'screenshot'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const FilesService = hookContext.services.FilesService
    const env = hookContext.env

    /**
     * It sets the "image" field on newly created
     * pick of the day items, if necessary.
     */
    action('picks_of_the_day.items.create', ({ payload, ...metadata }, context) =>
        handleAction({ payload, metadata, context })
    )

    /**
     * It sets the "image" field on updated pick
     * of the day items, if necessary.
     */
    action('picks_of_the_day.items.update', ({ payload, ...metadata }, context) =>
        handleAction({ payload, metadata, context })
    )

    /**
     * It handles the action logic that sets the "image" field on
     * created or updated pick of the day items, if necessary.
     *
     * @param data The action data.
     */
    async function handleAction({
        payload,
        metadata,
        context,
    }: {
        payload: any
        metadata: Record<string, any>
        context: any
    }) {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start action function`)

            // If payload contain "website_url", create screenshot
            // of website and add "image" to pick of the day item
            if (payload.website_url) {
                // Create browserless response variable
                let browserlessResponse

                // Get screenshot from browserless API
                logger.info(`${HOOK_NAME} hook: Get screenshot from browserless`)
                try {
                    browserlessResponse = await axios({
                        method: 'post',
                        url: `${env.BROWSERLESS_API_URL}function?TOKEN=${env.BROWSERLESS_API_TOKEN}`,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        data: JSON.stringify({
                            code: fs.readFileSync(path.resolve(__dirname, '../assets/browserless.js'), 'utf8'),
                            context: {
                                url: payload.website_url,
                            },
                        }),
                    })

                    // If an error occurs, log it and inform team via Slack
                } catch (error: any) {
                    logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
                    await postSlackMessage(
                        `Achtung: Der Screenshot für einen Pick of the Day konnte nicht automatisch erstellt werden. Der Screenshoot muss nun manuell über den folgenden Link hinzugefügt werden: ${
                            env.PUBLIC_URL
                        }admin/content/picks_of_the_day/${metadata.key || metadata.keys[0]}`
                    )
                }

                // If request to browserless was successful, add "image" to payload
                if (browserlessResponse && browserlessResponse.status === 200) {
                    // Create files service instance
                    const filesService = new FilesService({
                        accountability: context.accountability,
                        schema: context.schema,
                    })

                    // Create file name
                    const fileName = `${getUrlSlug(payload.website_url.replace(/https?:\/\//, ''))}.jpg`

                    // Upload image and set image ID
                    logger.info(`${HOOK_NAME} hook: Upload screenshot`)
                    const imageId = await filesService.uploadOne(Buffer.from(browserlessResponse.data, 'base64'), {
                        type: 'image/jpeg',
                        filename_download: fileName,
                        storage: env.STORAGE_LOCATIONS.split(',')[0],
                    })

                    // Create items service instance
                    const itemsService = new ItemsService(metadata.collection, {
                        accountability: context.accountability,
                        schema: context.schema,
                    })

                    // Add "image" to pick of the day item
                    logger.info(
                        `${HOOK_NAME} hook: Set "image" at "${
                            metadata.collection
                        }" item with ID "${metadata.key || metadata.keys[0]}"`
                    )
                    await itemsService.updateOne(metadata.key || metadata.keys[0], {
                        image: imageId,
                    })
                }
            }

            // Handle unknown errors
        } catch (error: any) {
            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }
    }
})
