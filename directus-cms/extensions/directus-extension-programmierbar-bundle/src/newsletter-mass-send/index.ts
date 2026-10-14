import { defineHook } from '@directus/extensions-sdk'
import { ISSUES_COLLECTION, loadNewsletterIssue } from '../newsletter/loadIssue.ts'
import { renderNewsletterIssue } from '../newsletter/render/index.ts'
import { runNewsletterSendTick, type SendDeps } from '../newsletter/send/run.ts'
import { UNSUBSCRIBE_URL_PLACEHOLDER } from '../newsletter/send/snapshot.ts'
import { createDirectusSendStore } from '../newsletter/send/store.ts'
import { sendRawEmail } from '../shared/email-service.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { getRequiredSetting } from '../shared/settings.ts'

const HOOK_NAME = 'newsletter-mass-send'

/**
 * Mass send of newsletter issues, once a minute (same pattern as `schedule-publication`).
 * Editors schedule an issue by setting status `scheduled` and `scheduled_at`; the logic
 * lives in `newsletter/send/run.ts`:
 *
 * 1. due issues: scheduled → sending (atomic), render once into `html_snapshot`, one
 *    `newsletter_sends` row per confirmed subscriber (unique `dedupe_key`);
 * 2. send queued rows within `newsletter_settings.daily_sending_limit` (Berlin day) and
 *    at most 50 per minute; subscribers no longer confirmed are `prevented`;
 * 3. stop when an editor changes the status away from `sending`;
 * 4. no queued rows left → sent + Slack summary.
 *
 * Overlapping ticks are skipped in-process; the database claims guard against a second
 * process.
 */
export default defineHook(({ schedule }, hookContext) => {
    const { services, getSchema, logger, env, database } = hookContext

    let running = false
    const notified = new Set<string>()

    const deps: SendDeps = {
        store: createDirectusSendStore({ services, getSchema, database }),
        now: () => new Date(),
        notified,
        logger,
        adminUrl: (issueId) => `${env.PUBLIC_URL}admin/content/${ISSUES_COLLECTION}/${issueId}`,
        getWebsiteUrl: () => getRequiredSetting('website_url', { logger, services, getSchema }),
        async renderSnapshot(issueId) {
            const schema = await getSchema()
            const issue = await loadNewsletterIssue(
                new services.ItemsService(ISSUES_COLLECTION, { schema, accountability: null }),
                issueId
            )
            const websiteUrl = await getRequiredSetting('website_url', { logger, services, getSchema })
            const { html, warnings, hidden } = await renderNewsletterIssue(issue, {
                websiteUrl,
                unsubscribeUrl: UNSUBSCRIBE_URL_PLACEHOLDER,
            })
            return { html, warnings, hiddenCount: hidden.length }
        },
        sendMail: (mail) => sendRawEmail(mail, { logger, services, getSchema }),
        async notify(text) {
            try {
                await postSlackMessage(text)
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Slack notification failed: ${error?.message ?? error}`)
            }
        },
    }

    schedule('*/1 * * * *', async () => {
        if (running) {
            logger.info(`${HOOK_NAME}: previous tick still running, skipping`)
            return
        }
        running = true
        try {
            await runNewsletterSendTick(deps)
        } finally {
            running = false
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
