import { defineHook } from '@directus/extensions-sdk';
import { createHookErrorConstructor } from '../shared/errors'
import {isPublishable} from '../shared/isPublishable';
import {postSlackMessage} from '../shared/postSlackMessage';

const HOOK_NAME = 'schedule-publication';

export default defineHook(({ schedule }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const FieldsService = hookContext.services.FieldsService
    const getSchema = hookContext.getSchema

    /**
     * It runs a cron job every minute that publishes items automatically.
     */
    schedule('*/1 * * * *', async () => {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start schedule function`);

            // Get database schema
            const globalSchema = await getSchema();

            // Create current ISO timestamp
            const timestamp = new Date().toISOString();

            // Run code for each collection async
            await Promise.all(
                Object.entries(globalSchema.collections).map(
                    async ([collectionName, collectionSchema]) => {
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
                            });

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
                            });

                            // Continue if at least one item was returned
                            if (items.length) {
                                // Create fields service instance
                                const fieldsService = new FieldsService({
                                    schema: globalSchema,
                                });

                                // Get fields of collection
                                const fields = await fieldsService.readAll(collectionName);

                                // Run code for each item async
                                await Promise.all(
                                    items.map(async (item: any) => {
                                        // Check if all required fields are set
                                        // We also need to bind the logger/pino instance properly for this forwarded function to work
                                        // Refer to: https://github.com/pinojs/pino/issues/1687
                                        const requiredFieldsAreSet = isPublishable(item, fields, logger.info.bind(logger));

                                        // Get primary key
                                        const primaryKey = item[collectionSchema.primary];

                                        // Publish item if all required fields are set
                                        if (requiredFieldsAreSet) {
                                            await itemsService.updateOne(primaryKey, {
                                                status: 'published',
                                            });

                                            // Log publication info
                                            logger.info(
                                                `${HOOK_NAME} hook: Published "${collectionName}" item with ID "${primaryKey}"`
                                            );

                                            // Otherwise unset "published_on" and send error message
                                        } else {
                                            // Log publication warning
                                            logger.warn(
                                                `${HOOK_NAME} hook: Could not publish "${collectionName}" item with ID "${primaryKey}" due to missing mandatory fields`
                                            );
                                            // Set "published_on" to "null" to exclude
                                            // item from next run of schedule function
                                            await itemsService.updateOne(
                                                item[collectionSchema.primary],
                                                {
                                                    published_on: null,
                                                }
                                            )
                                            try {
                                                // Inform team via Slack about problem with
                                                // necessary information to fix it
                                                await postSlackMessage([
                                                        `Achtung: Ein Eintrag in der "${collectionName}" Collection konnte nicht automatisch veröffentlicht werden, da ein Pflichtfeld nicht ausgefüllt wurde.`,
                                                        `Die Veröffentlichung muss nun manuell über den folgenden Link vorgenommen werden:`,
                                                        `${process.env.PUBLIC_URL}admin/content/${collectionName}/${item[collectionSchema.primary]}`
                                                    ].join(' ')
                                                );
                                            } catch (slackError: any) {
                                                logger.error(`${HOOK_NAME} hook: Error: Could not post message to Slack: ${slackError.message}`)
                                            }
                                        }
                                    })
                                );
                            }
                        }
                    }
                )
            );

            // Handle unknown errors
        } catch (error: any) {
            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }
    });

});
