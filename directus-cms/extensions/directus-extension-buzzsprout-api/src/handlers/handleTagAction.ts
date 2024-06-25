import { handleBuzzsprout } from "./buzzsprout";
import type { ActionData, Dependencies, Payload, PodcastData } from "./types";
import { getPodcastData } from "./podcastData";

/**
 * It handles the tag action and updates podcast
 * episodes at Buzzsprout, if necessary.
 *
 * @param HOOK_NAME The hook name.
 * @param actionData The action data.
 * @param dependencies The dependencies needed.
 */
export async function handleTagAction(
  HOOK_NAME: string,
  actionData: ActionData,
  dependencies: Dependencies,
): Promise<void> {
  const { payload, metadata, context } = actionData;
  const { ItemsService, logger, BaseException } = dependencies;

  try {
    // Log start info
    logger.info(
      `${HOOK_NAME} hook: Start "${metadata.collection}" action function`,
    );

    // If payload contains relevant changes, get whole tag item
    if (payload.name || payload.podcasts) {
      // Ensure metadata.key or metadata.keys[0] is not undefined
      const itemKey = metadata.key || (metadata.keys && metadata.keys[0]);
      if (!itemKey) {
        logger.error(`${HOOK_NAME} hook: Error: Invalid item key`);
        return;
      }

      // Create tag items service instance
      const tagItemsService = new ItemsService("tags", {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get tag item from tag item service by key
      const tagItem = await tagItemsService.readOne(itemKey);

      // Create podcast tag items service instance
      const podcastTagItemsService = new ItemsService("podcast_tags", {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Create podcast items service instance
      const podcastItemsService = new ItemsService("podcasts", {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get all podcast items async
      await Promise.all(
        tagItem.podcasts.map(async (podcastTagId: string | number) => {
          // Get podcast tag item from podcast tag item service by key
          const podcastTagItem =
            await podcastTagItemsService.readOne(podcastTagId);

          // Get podcast item from podcast item service by key
          const podcastItem = await podcastItemsService.readOne(
            podcastTagItem.podcast,
          );

          // If "buzzsprout_id" is set, update podcast episode at Buzzsprout
          if (typeof podcastItem.buzzsprout_id === "number") {
            // Get podcast data
            const podcastData: PodcastData = await getPodcastData(
              HOOK_NAME,
              podcastItem,
              context,
              dependencies,
            );

            // Update Buzzsprout episode
            const updatedActionData: ActionData<Payload> = {
              payload: {
                buzzsprout_id: podcastItem.buzzsprout_id,
                tags: podcastItem.tags,
              },
              context,
              metadata,
            };

            await handleBuzzsprout(
              HOOK_NAME,
              podcastData,
              updatedActionData,
              dependencies,
            );
          }
        }),
      );
    }

    // Handle unknown errors
  } catch (error: any) {
    logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
    throw new BaseException(error.message, 500, "UNKNOWN");
  }
}
