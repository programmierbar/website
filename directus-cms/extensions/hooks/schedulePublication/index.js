const postSlackMessage = require('../../helpers/postSlackMessage');
const { isPublishable } = require('./../../shared/isPublishable');

const HOOK_NAME = 'schedulePublication';

module.exports = (
  { schedule },
  {
    exceptions: { BaseException },
    getSchema,
    logger,
    services: { FieldsService, ItemsService },
  }
) => {
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
                  items.map(async (item) => {
                    // Check if all required fields are set
                    const requiredFieldsAreSet = isPublishable(item, fields);

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

                      await Promise.all([
                        // Set "published_on" to "null" to exclude
                        // item from next run of schedule function
                        await itemsService.updateOne(
                          item[collectionSchema.primary],
                          {
                            published_on: null,
                          }
                        ),

                        // Inform team via Slack about problem with
                        // necessary information to fix it
                        await postSlackMessage(
                          `Achtung: Ein Eintrag in der "${collectionName}" Collection konnte nicht automatisch veröffentlicht werden, da ein Pflichtfeld nicht ausgefüllt wurde. Die Veröffentlichung muss nun manuell über den folgenden Link vorgenommen werden: ${
                            process.env.PUBLIC_URL
                          }admin/content/${collectionName}/${
                            item[collectionSchema.primary]
                          }`
                        ),
                      ]);
                    }
                  })
                );
              }
            }
          }
        )
      );

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }
  });
};
