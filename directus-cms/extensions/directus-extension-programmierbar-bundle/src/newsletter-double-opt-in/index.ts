import { defineHook } from '@directus/extensions-sdk'
import { sendTemplatedEmail, type EmailServiceContext } from '../shared/email-service.ts'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import { getRequiredSetting } from '../shared/settings.ts'

const HOOK_NAME = 'newsletter-double-opt-in'
const COLLECTION = 'newsletter_subscribers'

// The confirmation link is valid for 24 hours. `confirm_token_expires_at` is
// NOT NULL and has no database default, so the filter below MUST populate it —
// otherwise every real signup would fail the insert.
//
// This is the single source of truth for the TTL: the CMS stamps the window on
// create AND on update (when a fresh token is issued), so callers — including
// the website's expired-link refresh — never compute an expiry themselves.
const CONFIRM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const TEMPLATE_KEY = 'newsletter_double_opt_in'

/**
 * Double-opt-in flow for newsletter subscribers.
 *
 * The website writes only `{ email }`. Directus fills the technical fields:
 * `confirm_token` / `unsubscribe_token` (uuid special flags), `signed_up_at`
 * (date-created) and `status` (default 'pending'). The one field it cannot
 * derive on its own is `confirm_token_expires_at` — this hook sets it, then
 * sends the confirmation mail once the row exists.
 *
 * When a confirmation link expires, the website issues a fresh `confirm_token`;
 * the update filter stamps the new window (so the TTL lives only here) and the
 * update action resends the mail, making a missed link recoverable.
 */
export default defineHook(({ filter, action }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema

    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. The double-opt-in email will not be sent.`)
        logger.warn(`${HOOK_NAME}: Make sure Directus email is configured in .env (EMAIL_TRANSPORT, etc.)`)
    }

    /**
     * Send (or resend) the double-opt-in confirmation mail for one subscriber.
     * Only pending subscribers are mailed. A failure to build the link or send
     * the mail is surfaced to Slack — the subscriber is otherwise stuck in
     * 'pending' with no way to confirm, and logs alone live only in the
     * hosting dashboard.
     */
    async function sendConfirmationMail(key: string | number, accountability: any) {
        const context: EmailServiceContext = { logger, services, getSchema, accountability }

        const schema = await getSchema()
        const subscribersService = new services.ItemsService(COLLECTION, {
            schema,
            accountability: { admin: true },
        })

        const subscriber = await subscribersService.readOne(key, {
            fields: ['id', 'email', 'status', 'confirm_token'],
        })

        if (!subscriber) {
            logger.error(`${HOOK_NAME}: subscriber ${key} not found`)
            return
        }

        // Guards against re-fires and rows imported directly in a non-pending state.
        if (subscriber.status !== 'pending') {
            logger.info(`${HOOK_NAME}: subscriber ${key} is '${subscriber.status}', no confirmation mail sent`)
            return
        }

        const notifyFailure = async (reason: string) => {
            const message =
                `:warning: *Newsletter*: Double-Opt-in-Mail an ${subscriber.email} nicht gesendet ` +
                `(${reason}). Der Subscriber bleibt 'pending'.`
            try {
                await postSlackMessage(message)
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME}: Slack notification failed: ${slackError?.message ?? slackError}`)
            }
        }

        // `website_url` is baked into the confirmation link inside a mail we then
        // send — a wrong or guessed host silently breaks confirmation. Require it
        // explicitly rather than falling back to a default.
        let websiteUrl: string
        try {
            websiteUrl = await getRequiredSetting('website_url', context)
        } catch {
            await notifyFailure("Setting 'website_url' ist nicht konfiguriert")
            return
        }

        const confirmUrl = `${websiteUrl}/newsletter/confirm?token=${encodeURIComponent(subscriber.confirm_token)}`

        const sent = await sendTemplatedEmail(
            {
                templateKey: TEMPLATE_KEY,
                to: subscriber.email,
                data: { confirm_url: confirmUrl },
            },
            context
        )

        if (!sent) {
            await notifyFailure(`Template '${TEMPLATE_KEY}' fehlt oder der Mailversand schlug fehl`)
            return
        }

        logger.info(`${HOOK_NAME}: sent double-opt-in mail to ${subscriber.email}`)
    }

    /** Add `confirm_token_expires_at = now + TTL` to a payload. */
    function withConfirmationWindow(payload: any) {
        const expiresAt = new Date(Date.now() + CONFIRM_TOKEN_TTL_MS).toISOString()
        return { ...(payload ?? {}), confirm_token_expires_at: expiresAt }
    }

    /** Filters must not break the write; wrap them in the bundle's hook error. */
    function safeFilter(handler: (payload: any) => any) {
        return (payload: any) => {
            try {
                return handler(payload)
            } catch (error: any) {
                logger.error(`${HOOK_NAME} hook: filter error: ${error.message}`)
                const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
                throw new hookError()
            }
        }
    }

    /**
     * BEFORE the row is written: stamp the confirmation window. A `filter`
     * (not `action`) is required because the column is NOT NULL with no default.
     */
    filter(
        `${COLLECTION}.items.create`,
        safeFilter((payload: any) => {
            // Respect an explicitly supplied value (e.g. a data import); only
            // default when the caller — like the website — omitted it.
            if (payload && payload.confirm_token_expires_at) {
                return payload
            }

            return withConfirmationWindow(payload)
        })
    )

    /**
     * BEFORE an update: when a fresh `confirm_token` is issued (the website's
     * expired-link recovery), stamp the matching window here. Keeping this in
     * the CMS means the 24h TTL is defined once — callers only say "reissue the
     * token", they don't compute expiry dates of their own.
     */
    filter(
        `${COLLECTION}.items.update`,
        safeFilter((payload: any) => {
            // Only a token rotation opens a new window. Other updates (the
            // confirm flip, unsubscribe) are left untouched.
            if (!payload?.confirm_token) {
                return payload
            }

            // An explicit window still wins, so imports/backfills stay possible.
            if (payload.confirm_token_expires_at) {
                return payload
            }

            return withConfirmationWindow(payload)
        })
    )

    /**
     * AFTER a subscriber is created: send the double-opt-in confirmation mail.
     */
    action(
        `${COLLECTION}.items.create`,
        safeAction(HOOK_NAME, logger, async (metadata: any, eventContext: any) => {
            const key = metadata?.key
            if (key === undefined || key === null) {
                logger.warn(`${HOOK_NAME}: create action fired without a key; skipping`)
                return
            }
            await sendConfirmationMail(key, eventContext?.accountability)
        })
    )

    /**
     * AFTER a subscriber is updated: resend the confirmation mail when a new
     * confirmation link came into existence — a rotated `confirm_token` (the
     * website's expired-link recovery) or an explicitly extended window. The
     * old mail is dead in both cases, so a fresh one has to go out.
     *
     * Other updates (the confirm flip, unsubscribe) touch neither field, so
     * they don't trigger a resend; and `sendConfirmationMail` re-checks
     * `status === 'pending'` as a second guard.
     */
    action(
        `${COLLECTION}.items.update`,
        safeAction(HOOK_NAME, logger, async (metadata: any, eventContext: any) => {
            const payload = metadata?.payload ?? {}
            if (payload.confirm_token === undefined && payload.confirm_token_expires_at === undefined) {
                return
            }

            const keys: Array<string | number> = Array.isArray(metadata?.keys)
                ? metadata.keys
                : metadata?.key !== undefined && metadata?.key !== null
                  ? [metadata.key]
                  : []

            for (const key of keys) {
                await sendConfirmationMail(key, eventContext?.accountability)
            }
        })
    )

    logger.info(`${HOOK_NAME} hook registered`)
})
