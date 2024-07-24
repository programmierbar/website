import { handleBuzzsprout } from './buzzsprout.ts'
import { getPodcastData } from './podcastData.ts'
import type { ActionData, BuzzsproutData, Dependencies, PodcastData } from './types.ts'
import { createHookErrorConstructor } from '../../shared/errors.ts';

/**
 * It handles the podcast action and creates or updates
 * the podcast episode at Buzzsprout, if necessary.
 *
 * @param HOOK_NAME The hook name.
 * @param actionData The action data.
 * @param dependencies The needed dependencies.
 */
export async function handlePodcastAction(
    HOOK_NAME: string,
    actionData: ActionData<PodcastData>,
    dependencies: Dependencies
): Promise<void> {
    const { payload, metadata, context } = actionData
    const { logger, ItemsService } = dependencies

    try {
        // Log start info
        logger.info(`${HOOK_NAME} hook: Start "${metadata.collection}" action function`)

        // Create podcast items service instance
        const podcastItemsService = new ItemsService('podcasts', {
            accountability: context.accountability,
            schema: context.schema,
        })

        // Ensure metadata.key or metadata.keys[0] is not undefined
        const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
        if (!itemKey) {
            logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
            return
        }

        // Get podcast item from podcast items service by key
        const podcastItem = await podcastItemsService.readOne(itemKey)

        // Create is creation boolean
        const isCreation = typeof podcastItem.buzzsprout_id !== 'number'

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
            podcastItem.audio_file

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
                payload.audio_file)

        // If podcast creation or update is not required, return
        if (!createdAndRequiredFieldsSet && !updatedWithRelevantFields) {
            logger.info(`${HOOK_NAME} hook: Podcast creation or update not required at Buzzsprout.`)
            return
        }

        logger.info(`${HOOK_NAME} hook: Podcast creation or update required at Buzzsprout.`)

        // Get podcast data
        const podcastData: PodcastData = await getPodcastData(HOOK_NAME, podcastItem, context, dependencies)

        // Create or update Buzzsprout episode and get its data
        const buzzsproutData: BuzzsproutData = await handleBuzzsprout(HOOK_NAME, podcastData, actionData, dependencies)

        if (!buzzsproutData) {
            logger.error(`${HOOK_NAME} hook: No data returned from handleBuzzsprout`)
            throw new Error("Did not receive Buzzsprout data.")
        }

        // Create update data object
        //const updateData: Partial<PodcastData> = {}
        const updateData: any = {}

        // If "buzzsprout_id" it not set, add it to update data
        if (!podcastItem.buzzsprout_id) {
            logger.info(`${HOOK_NAME} hook: Set "buzzsprout_id" at "${metadata.collection}" item with ID "${itemKey}"`)
            updateData.buzzsprout_id = buzzsproutData.id
        }

        // If "audio_url" is not set or "audio_file", "type", "number"
        // or "title" changed, add "audio_url" to update data
        if (!podcastItem.audio_url || payload.audio_file || payload.type || payload.number || payload.title) {
            logger.info(`${HOOK_NAME} hook: Set "audio_url" at "${metadata.collection}" item with ID "${itemKey}"`)
            updateData.audio_url = buzzsproutData.audio_url
        }

        // If No update data is set, return
        if (!Object.keys(updateData).length) {
            return
        }

        logger.info(`${HOOK_NAME} hook: Updating podcast item with id "${itemKey}" and data: ${JSON.stringify(updateData)}`)

        // If update data contains something, update podcast item
        await podcastItemsService.updateOne(itemKey, updateData)

        // Handle unknown errors
    } catch (error: any) {
        logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
        const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
        throw new hookError()
    }
}
