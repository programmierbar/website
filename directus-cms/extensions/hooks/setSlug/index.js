const {
  getUrlSlug,
  getFullSpeakerName,
  getFullPodcastTitle,
} = require('shared-code');

const HOOK_NAME = 'setSlug';

module.exports = ({ filter }, { logger, services: { ItemsService } }) => {
  /**
   * It creates the URL slug for speakers, podcasts
   * and meetups and retuns it with the payload.
   *
   * @param futureItem The future item.
   * @param data The filter data.
   *
   * @returns The payload including the slug.
   */
  function getPayloadWithSlug(futureItem, { payload, metadata }) {
    // Create function that logs info
    function logInfo() {
      logger.info(
        `${HOOK_NAME} hook: Set "slug" at ${
          metadata.keys?.[0]
            ? `"${metadata.collection}" item with ID "${metadata.keys[0]}"`
            : `newly created "${metadata.collection}" item`
        }`
      );
    }

    // If collection name is "speakers" and "academic_title", "first_name" and
    // "last_name" is set, log info and return payload with speaker slug
    if (
      metadata.collection === 'speakers' &&
      futureItem.first_name &&
      futureItem.last_name
    ) {
      logInfo();
      return {
        ...payload,
        slug: getUrlSlug(getFullSpeakerName(futureItem)),
      };
    }

    // If collection name is "podcasts" and "type", "number" and "title"
    // is set, log info and return payload with podcast slug
    if (
      metadata.collection === 'podcasts' &&
      futureItem.type &&
      futureItem.number &&
      futureItem.title
    ) {
      logInfo();
      return {
        ...payload,
        slug: getUrlSlug(getFullPodcastTitle(futureItem)),
      };
    }

    // If collection name is "podcasts" and "title" is set,
    // log info and return payload with meetup slug
    if (metadata.collection === 'meetups' && futureItem.title) {
      logInfo();
      return {
        ...payload,
        slug: getUrlSlug(futureItem.title),
      };
    }

    // Otherwise just return payload
    return payload;
  }

  /**
   * It handles the filter logic that sets the "slug" field
   * on newly created or updated items, if necessary.
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

      // Check if fields contain "slug"
      if (fields.slug) {
        // If item is newly created, return payload with "slug"
        if (type === 'create') {
          return getPayloadWithSlug(payload, { metadata, payload });
        }

        // If item has been updated, fields contain "slug" and
        // payload contains a field that is included in "slug",
        // create future item and return payload with "slug"
        if (
          type === 'update' &&
          ((metadata.collection === 'speakers' &&
            (payload.academic_title ||
              payload.first_name ||
              payload.last_name)) ||
            (metadata.collection === 'podcasts' &&
              (payload.type || payload.number || payload.title)) ||
            (metadata.collection === 'meetups' && payload.title))
        ) {
          // Create items service instance
          const itemsService = new ItemsService(metadata.collection, {
            accountability: context.accountability,
            schema: context.schema,
          });

          // Get item from item service by its key
          const item = await itemsService.readOne(metadata.keys[0]);

          // Create future item by merging item with payload
          const futureItem = { ...item, ...payload };

          // Return payload with "slug"
          return getPayloadWithSlug(futureItem, { metadata, payload });
        }
      }

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
    }

    // Otherwise just return payload
    return payload;
  }

  /**
   * It sets the "slug" field on newly created items, if necessary.
   */
  filter('items.create', (payload, metadata, context) =>
    handleFilter('create', { payload, metadata, context })
  );

  /**
   * It sets the "slug" field on updated items, if necessary.
   */
  filter('items.update', (payload, metadata, context) =>
    handleFilter('update', { payload, metadata, context })
  );
};
