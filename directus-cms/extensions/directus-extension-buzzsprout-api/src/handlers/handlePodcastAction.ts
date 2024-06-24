import { handleBuzzsprout } from './buzzsprout'

/**
 * It handles the podcast action and creates or updates
 * the podcast episode at Buzzsprout, if necessary.
 *
 * @param data The action data.
 */
export async function handlePodcastAction(HOOK_NAME: string, { payload, metadata, context }, { logger, ItemsService, BaseException, env }) {
  try {
    // Log start info
    logger.info(
      `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
    );

    // Create podcast items service instance
    const podcastItemsService = new ItemsService('podcasts', {
      accountability: context.accountability,
      schema: context.schema,
    });

    // Get podcast item from podcast items service by key
    const podcastItem = await podcastItemsService.readOne(
      metadata.key || metadata.keys[0]
    );

    // Create is creation boolean
    const isCreation = typeof podcastItem.buzzsprout_id !== 'number';

    // If "buzzsprout_id" is not set and all required fields
    // are set, create a podcast episode at Buzzsprout
    const createdAndRequiredFieldsSet =
      isCreation &&
      podcastItem.status &&
      (podcastItem.status !== 'published' || podcastItem.published_on) &&
      podcastItem.type &&
      podcastItem.number &&
      podcastItem.title &&
      podcastItem.description &&
      podcastItem.cover_image &&
      podcastItem.audio_file;
    // Otherwise if "buzzsprout_id" is set and payload contains
    // relevant changes, update podcast episode at Buzzsprout
    const updatedWithRelevantFields =
      !isCreation &&
      (payload.status ||
        payload.published_on ||
        payload.type ||
        payload.number ||
        payload.title ||
        payload.description ||
        payload.cover_image ||
        payload.audio_file);

    // If podcast creation or update is not required, return
    if (!createdAndRequiredFieldsSet && !updatedWithRelevantFields) {
      logger.info(
        `${HOOK_NAME} hook: Podcast creation or update not required at Buzzsprout.`
      );
      return;
    }

    logger.info(
      `${HOOK_NAME} hook: Podcast creation or update required at Buzzsprout.`
    );

    // Get podcast data
    const podcastData = await getPodcastData(podcastItem, {
      context,
    });

    // Create or update Buzzsprout episode and get its data
    const buzzsproutData = await handleBuzzsprout(HOOK_NAME, podcastData, {
      payload,
      context,
    }, {logger, ItemsService, env});

    // Create update data object
    const updateData = {};

    // If "buzzsprout_id" it not set, add it to update data
    if (!podcastItem.buzzsprout_id) {
      logger.info(
        `${HOOK_NAME} hook: Set "buzzsprout_id" at "${
          metadata.collection
        }" item with ID "${metadata.key || metadata.keys[0]}"`
      );
      updateData.buzzsprout_id = buzzsproutData.id;
    }

    // If "audio_url" is not set or "audio_file", "type", "number"
    // or "title" changed, add "audio_url" to update data
    if (
      !podcastItem.audio_url ||
      payload.audio_file ||
      payload.type ||
      payload.number ||
      payload.title
    ) {
      logger.info(
        `${HOOK_NAME} hook: Set "audio_url" at "${
          metadata.collection
        }" item with ID "${metadata.key || metadata.keys[0]}"`
      );
      updateData.audio_url = buzzsproutData.audio_url;
    }

    // If No update data is set, return
    if (!Object.keys(updateData).length) {
      return;
    }

    // If update data contains something, update podcast item
    await podcastItemsService.updateOne(
      metadata.key || metadata.keys[0],
      updateData
    );

    // Handle unknown errors
  } catch (error) {
    logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
    throw new BaseException(error.message, 500, 'UNKNOWN');
  }
}
