import { defineHook } from '@directus/extensions-sdk'
import { generateContent } from './generateContent.js'

const HOOK_NAME = 'content-generation'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    if (!env.GEMINI_API_KEY) {
        logger.warn(`${HOOK_NAME} hook: GEMINI_API_KEY not set. Content generation will not be active.`)
        return
    }

    // Trigger on podcast update when transcript_text is added
    action('podcasts.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Check if transcript_text was updated
        const hasTranscriptText = payload.transcript_text && payload.transcript_text.trim().length > 0

        if (!hasTranscriptText) {
            return
        }

        const podcastId = keys[0]
        logger.info(`${HOOK_NAME} hook: Transcript detected for podcast ${podcastId}, triggering content generation`)

        // Run content generation asynchronously (don't block the update)
        generateContent(HOOK_NAME, podcastId, {
            logger,
            ItemsService,
            getSchema,
            env,
            eventContext,
        }).catch((err) => {
            logger.error(`${HOOK_NAME} hook: Content generation failed for podcast ${podcastId}:`, err)
        })
    })
})
