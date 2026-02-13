import { defineHook } from '@directus/extensions-sdk'
import { generateContent } from './generateContent.js'
import { postSlackMessage } from '../shared/postSlackMessage.ts'

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
        }).catch(async (err) => {
            logger.error(`${HOOK_NAME} hook: Content generation failed for podcast ${podcastId}:`, err)

            try {
                const podcastUrl = `${env.PUBLIC_URL}admin/content/podcasts/${podcastId}`
                await postSlackMessage(
                    `:warning: *${HOOK_NAME}*: Content generation failed for podcast ${podcastId}.\n` +
                        `Error: ${err?.message || err}\n` +
                        `Podcast: ${podcastUrl}`
                )
            } catch (slackErr: any) {
                logger.error(`${HOOK_NAME} hook: Failed to send Slack notification: ${slackErr.message}`)
            }
        })
    })
})
