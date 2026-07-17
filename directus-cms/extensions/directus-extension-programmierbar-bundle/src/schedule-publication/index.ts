import { defineHook } from '@directus/extensions-sdk'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { isPublishable } from '../shared/isPublishable.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'

const HOOK_NAME = 'schedule-publication'

export default defineHook(({ schedule }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const FieldsService = hookContext.services.FieldsService
    const env = hookContext.env
    const getSchema = hookContext.getSchema

    /**
     * Unset "published_on" so a failed item is excluded from the next run (the
     * schedule query only matches items whose "published_on" is set and due), and
     * notify the team so the publication can be completed manually. Without the
     * unset, the item would keep matching and fail on every run.
     *
     * The unset is a `{ published_on: null }` update with no status change, so it
     * does not re-trigger any publish-related hook.
     *
     * @param itemsService The ItemsService for the item's collection.
     * @param collectionName The collection name (for the message + admin link).
     * @param primaryKey The primary key of the item to de-schedule.
     * @param reasonClause A German clause explaining why publication failed.
     */
    async function descheduleItem(
        itemsService: any,
        collectionName: string,
        primaryKey: string | number,
        reasonClause: string
    ) {
        await itemsService.updateOne(primaryKey, { published_on: null })

        try {
            // Inform team via Slack about the problem with the information to fix it
            await postSlackMessage(
                [
                    `Achtung: Ein Eintrag in der "${collectionName}" Collection konnte nicht automatisch veröffentlicht werden, ${reasonClause}.`,
                    `Die Veröffentlichung muss nun manuell über den folgenden Link vorgenommen werden:`,
                    `${env.PUBLIC_URL}admin/content/${collectionName}/${primaryKey}`,
                ].join(' ')
            )
        } catch (slackError: any) {
            logger.error(`${HOOK_NAME} hook: Error: Could not post message to Slack: ${slackError.message}`)
        }
    }

    /**
     * It runs a cron job every minute that publishes items automatically.
     */
    schedule('*/1 * * * *', async () => {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start schedule function`)

            // Get database schema
            const globalSchema = await getSchema()

            // Create current ISO timestamp
            const timestamp = new Date().toISOString()

            // Run code for each collection async
            await Promise.all(
                Object.entries(globalSchema.collections).map(async ([collectionName, collectionSchema]) => {
                    // Exclude Directus and singleton collections and also collections
                    // without "status" and "published_on" fields
                    if (
                        !collectionName.includes('directus_') &&
                        !collectionSchema.singleton &&
                        collectionSchema.fields.status &&
                        collectionSchema.fields.published_on
                    ) {
                        // Create items service instance
                        const itemsService = new ItemsService(collectionName, {
                            schema: globalSchema,
                        })

                        // Get any item whose "status" is "draft" and whose "published_on"
                        // is less than or equal to the current timestamp
                        const items = await itemsService.readByQuery({
                            filter: {
                                _and: [
                                    {
                                        status: {
                                            _eq: 'draft',
                                        },
                                    },
                                    {
                                        published_on: {
                                            _lte: timestamp,
                                        },
                                    },
                                ],
                            },
                        })

                        // Continue if at least one item was returned
                        if (items.length) {
                            // Create fields service instance
                            const fieldsService = new FieldsService({
                                schema: globalSchema,
                            })

                            // Get fields of collection
                            const fields = await fieldsService.readAll(collectionName)

                            // Run code for each item async
                            await Promise.all(
                                items.map(async (item: any) => {
                                    // Get primary key
                                    const primaryKey = item[collectionSchema.primary]

                                    // Check if all required fields are set
                                    // We also need to bind the logger/pino instance properly for this forwarded function to work
                                    // Refer to: https://github.com/pinojs/pino/issues/1687
                                    const requiredFieldsAreSet = isPublishable(item, fields, logger.info.bind(logger))

                                    // De-schedule items that are missing mandatory fields
                                    if (!requiredFieldsAreSet) {
                                        logger.warn(
                                            `${HOOK_NAME} hook: Could not publish "${collectionName}" item with ID "${primaryKey}" due to missing mandatory fields`
                                        )
                                        await descheduleItem(
                                            itemsService,
                                            collectionName,
                                            primaryKey,
                                            'da ein Pflichtfeld nicht ausgefüllt wurde'
                                        )
                                        return
                                    }

                                    // Publish the item. A downstream hook can still reject the
                                    // publish (e.g. the news publish guard when a linked source item
                                    // is incomplete); catch that so a single item cannot fail the
                                    // whole run, and de-schedule it so it does not retry every minute
                                    // until fixed.
                                    try {
                                        await itemsService.updateOne(primaryKey, {
                                            status: 'published',
                                        })

                                        // Log publication info
                                        logger.info(
                                            `${HOOK_NAME} hook: Published "${collectionName}" item with ID "${primaryKey}"`
                                        )
                                    } catch (publishError: any) {
                                        logger.warn(
                                            `${HOOK_NAME} hook: Could not publish "${collectionName}" item with ID "${primaryKey}": ${publishError.message}`
                                        )
                                        await descheduleItem(
                                            itemsService,
                                            collectionName,
                                            primaryKey,
                                            `da die Veröffentlichung abgelehnt wurde (${publishError.message})`
                                        )
                                    }
                                })
                            )
                        }
                    }
                })
            )

            // Handle unknown errors
        } catch (error: any) {
            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }
    })
})
