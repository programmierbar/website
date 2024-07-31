import type { Context, Dependencies, PickOfTheDay, PodcastData, Tag } from './types.ts'

/**
 * It adds the pick of the day and tag items to the podcast item object.
 *
 * @param HOOK_NAME
 * @param podcastItem A podcast item.
 * @param context
 * @param dependencies
 *
 * @returns The podcast data.
 */
export async function getPodcastData(
    HOOK_NAME: string,
    podcastItem: PodcastData,
    context: Context,
    dependencies: Dependencies
): Promise<PodcastData> {
    const { logger, ItemsService } = dependencies

    // Log start info
    logger.info(`${HOOK_NAME} hook: Query podcast data from Directus`)

    // Create member items service instance
    const memberItemsService = new ItemsService('members', {
        accountability: context.accountability,
        schema: context.schema,
    })

    // Create speaker items service instance
    const speakerItemsService = new ItemsService('speakers', {
        accountability: context.accountability,
        schema: context.schema,
    })

    // Create pick of the day items service instance
    const pickOfTheDayItemsService = new ItemsService('picks_of_the_day', {
        accountability: context.accountability,
        schema: context.schema,
    })

    // Log info
    logger.info(`${HOOK_NAME} hook: Query pick of the day items from Directus`)

    // Get pick of the day items with member or speaker
    const pickOfTheDayItems: PickOfTheDay[] = await Promise.all(
        podcastItem.picks_of_the_day!.map(async (pick) => {
            const pickOfTheDay = await pickOfTheDayItemsService.readOne(pick.id)
            return {
                ...pickOfTheDay,
                member: pickOfTheDay.member && (await memberItemsService.readOne(pickOfTheDay.member)),
                speaker: pickOfTheDay.speaker && (await speakerItemsService.readOne(pickOfTheDay.speaker)),
            }
        })
    )

    let tagItems: Tag[] = []
    try {
        // Create podcast tag items service instance
        const podcastTagItemsService = new ItemsService('podcast_tags', {
            accountability: context.accountability,
            schema: context.schema,
        })

        // Create tag items service instance
        const tagItemsService = new ItemsService('tags', {
            accountability: context.accountability,
            schema: context.schema,
        })

        // Log info
        logger.info(`${HOOK_NAME} hook: Query tag items from Directus`)

        // Get tag items from tag item service by keys
        tagItems = await Promise.all(
            podcastItem.tags!.map(async (podcastTag) =>
                tagItemsService.readOne((await podcastTagItemsService.readOne(podcastTag.id)).tag)
            )
        )
    } catch (error: any) {
        logger.error(`${HOOK_NAME} hook: Could not query tags "${error.message}"`)
    }

    // Return podcast data
    return {
        ...podcastItem,
        picks_of_the_day: pickOfTheDayItems,
        tags: tagItems,
    }
}
