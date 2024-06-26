import { handleBuzzsprout } from './buzzsprout'
import { buzzsproutError } from './errors.js'
import { getPodcastData } from './podcastData'
import type { ActionData, Dependencies, Payload, PickOfTheDayPayload } from './types'

/**
 * It handles the pick of the day action and updates the associated
 * podcast episode at Buzzsprout, if necessary.
 *
 * @param HOOK_NAME the name of the hook
 * @param actionData the action data
 * @param dependencies
 */
export async function handlePickOfTheDayAction(
    HOOK_NAME: string,
    actionData: ActionData<PickOfTheDayPayload>,
    dependencies: Dependencies
): Promise<void> {
    const { payload, metadata, context } = actionData
    const { ItemsService, logger } = dependencies
    try {
        // Log start info
        logger.info(`${HOOK_NAME} hook: Start "${metadata.collection}" action function`)

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
            })

            // Ensure metadata.key or metadata.keys[0] is not undefined
            const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
            if (!itemKey) {
                logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
                return
            }

            // Get pick of the day item from pick of the day item service by key
            const pickOfTheDayItem = await pickOfTheDayItemsService.readOne(itemKey)

            // If entry is associated with a podcast, get podcast item
            if (pickOfTheDayItem.podcast) {
                // Create podcast items service instance
                const podcastItemsService = new ItemsService('podcasts', {
                    accountability: context.accountability,
                    schema: context.schema,
                })

                // Get podcast item from podcast item service by key
                const podcastItem = await podcastItemsService.readOne(pickOfTheDayItem.podcast)

                // If "buzzsprout_id" is set, update podcast episode at Buzzsprout
                if (typeof podcastItem.buzzsprout_id === 'number') {
                    // Get podcast data
                    const podcastData = await getPodcastData(HOOK_NAME, podcastItem, context, dependencies)

                    // Update Buzzsprout episode
                    const updatedActionData: ActionData<Payload> = {
                        payload: {
                            buzzsprout_id: podcastItem.buzzsprout_id,
                            picks_of_the_day: podcastItem.picks_of_the_day,
                        },
                        context,
                        metadata,
                    }

                    // Update Buzzsprout episode
                    await handleBuzzsprout(HOOK_NAME, podcastData, updatedActionData, dependencies)
                }
            }
        }

        // Handle unknown errors
    } catch (error: any) {
        logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
        const customError = buzzsproutError(error.message)
        throw new customError()
    }
}
