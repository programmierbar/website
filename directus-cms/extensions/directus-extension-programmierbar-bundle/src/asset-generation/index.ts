import { defineHook } from '@directus/extensions-sdk'
import { generateAssetsForPodcast, regenerateAssets } from './generateAssets.ts'

const HOOK_NAME = 'asset-generation'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const FilesService = hookContext.services.FilesService
    const AssetsService = hookContext.services.AssetsService
    const getSchema = hookContext.getSchema
    const env = hookContext.env

    /**
     * Trigger asset generation when a speaker's portal submission is approved.
     * This indicates the speaker has submitted their info and images, and an admin approved them.
     */
    action('speakers.items.update', async ({ payload, keys }, context) => {
        // Only trigger when portal_submission_status changes to 'approved'
        if (payload.portal_submission_status !== 'approved') {
            return
        }

        const speakerId = keys?.[0]
        if (!speakerId) {
            logger.warn(`${HOOK_NAME}: No speaker ID found in update`)
            return
        }

        logger.info(`${HOOK_NAME}: Speaker ${speakerId} submission approved, finding linked podcasts`)

        try {
            const schema = await getSchema()

            // Find podcasts that have this speaker by querying the speaker's podcasts relation
            const speakersService = new ItemsService('speakers', {
                schema,
                accountability: context.accountability,
            })

            const speaker = await speakersService.readOne(speakerId, {
                fields: ['id', 'podcasts.podcast'],
            })

            if (!speaker?.podcasts || speaker.podcasts.length === 0) {
                logger.info(`${HOOK_NAME}: No podcasts linked to speaker ${speakerId}`)
                return
            }

            const podcastIds = speaker.podcasts
                .map((p: { podcast: number | string }) => p.podcast)
                .filter(Boolean)

            if (podcastIds.length === 0) {
                logger.info(`${HOOK_NAME}: No valid podcast IDs found for speaker ${speakerId}`)
                return
            }

            logger.info(`${HOOK_NAME}: Found ${podcastIds.length} podcast(s) linked to speaker ${speakerId}`)

            // Generate assets for each podcast (async, non-blocking)
            for (const podcastId of podcastIds) {
                generateAssetsForPodcast(HOOK_NAME, podcastId, {
                    logger,
                    ItemsService,
                    FilesService,
                    AssetsService,
                    getSchema,
                    env,
                    accountability: context.accountability,
                }).catch((err) => {
                    logger.error(`${HOOK_NAME}: Asset generation failed for podcast ${podcastId}: ${err.message}`)
                })
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing speaker approval: ${err.message}`)
        }
    })

    /**
     * Trigger asset regeneration when regenerate_assets is set to true on a podcast.
     */
    action('podcasts.items.update', async ({ payload, keys }, context) => {
        // Only trigger when regenerate_assets is set to true
        if (payload.regenerate_assets !== true) {
            return
        }

        if (!keys || keys.length === 0) {
            logger.warn(`${HOOK_NAME}: No podcast IDs found in update`)
            return
        }

        logger.info(`${HOOK_NAME}: Regenerate assets requested for ${keys.length} podcast(s)`)

        // Reset the flag immediately for all podcasts
        try {
            const schema = await getSchema()
            const podcastsService = new ItemsService('podcasts', {
                schema,
                accountability: context.accountability,
            })

            for (const podcastId of keys) {
                await podcastsService.updateOne(podcastId, {
                    regenerate_assets: false,
                })
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Failed to reset regenerate_assets flag: ${err.message}`)
        }

        // Regenerate assets for each podcast (async, non-blocking)
        for (const podcastId of keys) {
            regenerateAssets(HOOK_NAME, podcastId, {
                logger,
                ItemsService,
                FilesService,
                AssetsService,
                getSchema,
                env,
                accountability: context.accountability,
            }).catch((err) => {
                logger.error(`${HOOK_NAME}: Asset regeneration failed for podcast ${podcastId}: ${err.message}`)
            })
        }
    })
})
