import { handleBuzzsprout } from './buzzsprout'

/**
 * It handles the pick of the day action and updates the associated
 * podcast episode at Buzzsprout, if necessary.
 *
 * @param data The action data.
 */
export async function handlePickOfTheDayAction(HOOK_NAME: string, { payload, metadata, context }, {ItemsService, logger, BaseException}) {
  try {
    // Log start info
    logger.info(
      `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
    );

    // If payload contains relevant changes,
    // get whole pick of the day item
    if (
      payload.name ||
      payload.website_url ||
      payload.description ||
      payload.podcast ||
      payload.member ||
      payload.speaker
    ) {
      // Create pick of the day items service instance
      const pickOfTheDayItemsService = new ItemsService('picks_of_the_day', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get pick of the day item from pick of the day item service by key
      const pickOfTheDayItem = await pickOfTheDayItemsService.readOne(
        metadata.key || metadata.keys[0]
      );

      // If entry is associated with a podcast, get podcast item
      if (pickOfTheDayItem.podcast) {
        // Create podcast items service instance
        const podcastItemsService = new ItemsService('podcasts', {
          accountability: context.accountability,
          schema: context.schema,
        });

        // Get podcast item from podcast item service by key
        const podcastItem = await podcastItemsService.readOne(
          pickOfTheDayItem.podcast
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
              picks_of_the_day: podcastItem.picks_of_the_day,
            },
            context,
          });
        }
      }
    }

    // Handle unknown errors
  } catch (error) {
    logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
    throw new BaseException(error.message, 500, 'UNKNOWN');
  }
}