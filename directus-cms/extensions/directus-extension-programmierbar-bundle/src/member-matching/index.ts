import { defineHook } from '@directus/extensions-sdk'
import { matchMembersFromTranscript } from './matchMembers.js'

const HOOK_NAME = 'member-matching'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    // Trigger on podcast update when transcript_text is added
    action('podcasts.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Check if transcript_text was updated
        const hasTranscriptText = payload.transcript_text && payload.transcript_text.trim().length > 0

        if (!hasTranscriptText) {
            return
        }

        const podcastId = keys[0]
        logger.info(`${HOOK_NAME} hook: Transcript detected for podcast ${podcastId}, attempting to match members`)

        // Run member matching (don't await - let it run alongside other hooks)
        matchMembersFromTranscript(HOOK_NAME, podcastId, payload.transcript_text, {
            logger,
            ItemsService,
            getSchema,
            eventContext,
        }).catch((err) => {
            logger.error(`${HOOK_NAME} hook: Member matching failed for podcast ${podcastId}:`, err)
        })
    })
})
