const HOOK_NAME = 'setPublishedOn';

module.exports = (
  { filter },
  { exceptions: { BaseException }, logger, services: { ItemsService } }
) => {
  /**
   * It handles the filter logic that sets the "published_on"
   * field on newly created or updated items, if necessary.
   *
   * @param type The filter typ.
   * @param data The filter data.
   *
   * @returns The new payload.
   */
  async function handleFilter(type, { payload, metadata, context }) {
    try {
      // Log start info
      logger.info(`${HOOK_NAME} hook: Start filter function`);

      // Get fields of collection
      const { fields } = context.schema.collections[metadata.collection];

      // Check if fields contain "status" and "published_on" and that
      // "status" is "published" and "published_on" is not set
      if (
        fields.status &&
        fields.published_on &&
        payload.status === 'published' &&
        !payload.published_on
      ) {
        // If item is newly created, log info and return payload
        // with "published_on" set to current timestamp
        if (type === 'create') {
          logger.info(
            `${HOOK_NAME} hook: Set "published_on" at newly created "${metadata.collection}" item`
          );
          return {
            ...payload,
            published_on: new Date().toISOString(),
          };
        }

        // If item has been updated, return payload with "published_on"
        // set to current timestamp if it is not already set
        if (type === 'update') {
          // Create items service instance
          const itemsService = new ItemsService(metadata.collection, {
            accountability: context.accountability,
            schema: context.schema,
          });

          // Get item from item service by its key
          const item = await itemsService.readOne(
            metadata.keys && metadata.keys[0]
          );

          // Return payload with "published_on" set to current
          // timestamp, if it is not already set
          if (!(item && item.published_on)) {
            logger.info(
              `${HOOK_NAME} hook: Set "published_on" at "${metadata.collection}" item with ID "${metadata.keys[0]}"`
            );
            return {
              ...payload,
              published_on: new Date().toISOString(),
            };
          }
        }
      }

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }

    // Otherwise just return payload
    return payload;
  }

  /**
   * It sets the "published_on" field on newly created items, if necessary.
   */
  filter('items.create', (payload, metadata, context) =>
    handleFilter('create', { payload, metadata, context })
  );

  /**
   * It sets the "published_on" field on updated items, if necessary.
   */
  filter('items.update', (payload, metadata, context) =>
    handleFilter('update', { payload, metadata, context })
  );
};
