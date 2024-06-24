import { handleBuzzsprout } from './buzzsprout'

/**
 * It handles the tag action and updates podcast
 * episodes at Buzzsprout, if necessary.
 *
 * @param data The action data.
 */
export async function handleTagAction(HOOK_NAME, { payload, metadata, context }, {ItemsService, logger, BaseException}) {
  try {
    // Log start info
    logger.info(
      `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
    );

    // If payload contains relevant changes, get whole tag item
    if (payload.name || payload.podcasts) {
      // Create tag items service instance
      const tagItemsService = new ItemsService('tags', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get tag item from tag item service by key
      const tagItem = await tagItemsService.readOne(
        metadata.key || metadata.keys[0]
      );

      // Create podcast tag items service instance
      const podcastTagItemsService = new ItemsService('podcast_tags', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Create podcast items service instance
      const podcastItemsService = new ItemsService('podcasts', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get all podcast items async
      await Promise.all(
        tagItem.podcasts.map(async (podcastTagId) => {
          // Get podcast tag item from podcast tag item service by key
          const podcastTagItem = await podcastTagItemsService.readOne(
            podcastTagId
          );

          // Get podcast item from podcast item service by key
          const podcastItem = await podcastItemsService.readOne(
            podcastTagItem.podcast
          );

          // If "buzzsprout_id" is set, update podcast episode at Buzzsprout
          if (typeof podcastItem.buzzsprout_id === 'number') {
            // Get podcast data
            const podcastData = await getPodcastData(podcastItem, {
              context,
            });

            // Update Buzzsprout episode
            await handleBuzzsprout(podcastData, {
              payload: {
                tags: podcastItem.tags,
              },
              context,
            });
          }
        })
      );
    }

    // Handle unknown errors
  } catch (error) {
    logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
    throw new BaseException(error.message, 500, 'UNKNOWN');
  }
}
