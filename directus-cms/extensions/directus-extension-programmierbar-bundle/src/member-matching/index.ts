import { defineHook } from '@directus/extensions-sdk'
import { matchMembersFromTranscript } from './matchMembers.js'
import { postSlackMessage } from '../shared/postSlackMessage.js'

const HOOK_NAME = 'member-matching'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    function handlePodcastAction(metadata: any, eventContext: any) {
        const { payload } = metadata
        const podcastId = metadata.key || metadata.keys[0]

        // Check if transcript_text was included
        const hasTranscriptText = payload.transcript_text && payload.transcript_text.trim().length > 0

        if (!hasTranscriptText) {
            return
        }

        logger.info(`${HOOK_NAME} hook: Transcript detected for podcast ${podcastId}, attempting to match members`)

        // Run member matching (don't await - let it run alongside other hooks)
        matchMembersFromTranscript(HOOK_NAME, podcastId, payload.transcript_text, {
            logger,
            ItemsService,
            getSchema,
            eventContext,
        }).catch(async (err) => {
            logger.error(`${HOOK_NAME} hook: Member matching failed for podcast ${podcastId}:`, err)
            try {
                await postSlackMessage(
                    `:warning: *${HOOK_NAME} hook*: Member-Matching für Podcast ${podcastId} fehlgeschlagen. Error: ${err?.message || err}`
                )
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME} hook: Could not post to Slack: ${slackError.message}`)
            }
        })
    }

    // Trigger on podcast creation or update when transcript_text is present
    action('podcasts.items.create', handlePodcastAction)
    action('podcasts.items.update', handlePodcastAction)
})
