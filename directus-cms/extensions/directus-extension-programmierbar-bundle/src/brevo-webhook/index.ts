import { defineEndpoint } from '@directus/extensions-sdk'
import { berlinDayKey } from '../newsletter/send/time.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { checkBasicAuth } from './auth.ts'
import { normalizeEvents } from './events.ts'
import { processBrevoEvents } from './process.ts'
import { createDirectusWebhookStore } from './store.ts'

const ENDPOINT_NAME = 'brevo-webhook'

/**
 * POST /brevo-webhook — receiver for Brevo's transactional webhooks. All CMS and website
 * mail goes through the Brevo SMTP relay, so these events cover every mail of the account;
 * the newsletter ones are told apart by the headers from `newsletter/brevoTracking.ts`.
 *
 * - hard bounce / invalid address → subscriber `bounced` (any mail)
 * - spam complaint → `complained` (newsletter mails only), with a Slack message
 * - hard bounce / invalid address / blocked on any other mail (tickets, invoices, …) → Slack
 *   warning, so the mail can be delivered another way
 * - Brevo-side unsubscribe → `unsubscribed` (newsletter mails only)
 * - on a newsletter send, the event is noted in the row's `error`
 *
 * Public route (no Directus login), authenticated by HTTP Basic auth against
 * `BREVO_WEBHOOK_SECRET` (see `auth.ts`). Answers 200 for every authenticated request it
 * could process, including events it ignores and unknown addresses, so Brevo does not
 * retry them; 500 if the database write failed.
 */
export default defineEndpoint((router, context) => {
    const { logger, env, database } = context

    const store = createDirectusWebhookStore({ database })
    const notified = new Set<string>()
    let notifiedDay = ''

    /** Post to Slack. Never throws; false when the message could not be posted. */
    async function notify(text: string): Promise<boolean> {
        try {
            await postSlackMessage(text)
            return true
        } catch (error: any) {
            logger.error(`${ENDPOINT_NAME}: Slack notification failed: ${error?.message ?? error}`)
            return false
        }
    }

    /**
     * Recurring failures and re-delivered events: one Slack message per key and day, not one
     * per Brevo request. The key is reserved before posting, so concurrent requests do not
     * all post while the first one is in flight, and released again if Slack did not take the
     * message, so a later request retries it. Kept in memory: a restart forgets the keys, and
     * the keys of past days are dropped.
     */
    async function notifyOnce(key: string, text: string): Promise<void> {
        const today = berlinDayKey(new Date())
        if (today !== notifiedDay) {
            notified.clear()
            notifiedDay = today
        }
        if (notified.has(key)) return
        notified.add(key)
        if (!(await notify(text))) notified.delete(key)
    }

    router.post('/', async (req: any, res: any) => {
        const auth = checkBasicAuth(req.headers?.authorization, env.BREVO_WEBHOOK_SECRET)
        if (!auth.ok) {
            if (auth.status === 503) {
                logger.error(`${ENDPOINT_NAME}: ${auth.reason}, refusing all events`)
                await notifyOnce(
                    'secret-missing',
                    ':warning: *Newsletter*: `BREVO_WEBHOOK_SECRET` ist im Directus nicht gesetzt – Bounces und Spam-Beschwerden von Brevo werden abgelehnt und nicht verarbeitet.'
                )
            } else {
                logger.warn(`${ENDPOINT_NAME}: rejected request: ${auth.reason}`)
            }
            res.status(auth.status).send({ error: auth.status === 503 ? 'not configured' : 'unauthorized' })
            return
        }

        const events = normalizeEvents(req.body)
        try {
            const result = await processBrevoEvents(events, {
                store,
                now: () => new Date(),
                logger,
                notify,
                notifyOnce,
            })
            res.status(200).send(result)
        } catch (error: any) {
            const message = error?.message ?? String(error)
            logger.error(`${ENDPOINT_NAME}: processing ${events.length} event(s) failed: ${message}`)
            await notifyOnce(
                `error:${message}`,
                `:x: *Newsletter*: Brevo-Webhook konnte Ereignisse nicht verarbeiten (${message}). Bounces/Beschwerden gehen ggf. verloren, falls Brevo nicht erneut zustellt.`
            )
            res.status(500).send({ error: 'processing failed' })
        }
    })

    logger.info(`${ENDPOINT_NAME} endpoint registered`)
})
