import { parseNewsletterTracking } from '../newsletter/brevoTracking.ts'

/**
 * Brevo transactional webhook events (https://developers.brevo.com/docs/transactional-webhooks).
 * Only the fields this hook reads; Brevo sends many more.
 */
export interface BrevoEvent {
    event?: unknown
    email?: unknown
    reason?: unknown
    subject?: unknown
    'message-id'?: unknown
    'X-Mailin-custom'?: unknown
    tags?: unknown
    /** Some events (e.g. `unsubscribed`) carry a stringified array here instead of `tags`. */
    tag?: unknown
}

/** What a subscriber becomes. Only `pending` and `confirmed` subscribers are ever moved. */
export type SubscriberTransition = 'bounced' | 'complained' | 'unsubscribed'

export interface Decision {
    event: string
    /** Normalised like the website stores it (trimmed, lower-cased). Empty if missing. */
    email: string
    /** Null: the subscriber stays as it is. */
    transition: SubscriberTransition | null
    /** `newsletter_sends` row to note the event on (sent rows only), or null. */
    sendId: string | null
    /** Text for `newsletter_sends.error`. */
    note: string
    isNewsletter: boolean
    /**
     * A non-newsletter mail (ticket, invoice, speaker portal, …) did not reach its recipient
     * (`hard_bounce`, `invalid_email`, `blocked`, `error`): someone should know, e.g. to get an invoice
     * to the buyer another way.
     */
    mailFailure: boolean
    /** Brevo's reason, trimmed; null if missing or empty. */
    reason: string | null
    subject: string | null
    messageId: string | null
}

/** Events that mean a mail did not reach its recipient. */
const UNDELIVERED_EVENTS = new Set(['hard_bounce', 'invalid_email', 'blocked', 'error'])

function optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Brevo sends one event per request, or an array when the webhook is created with
 * `batched: true`. Both are accepted; anything that is not an object is dropped.
 */
export function normalizeEvents(body: unknown): BrevoEvent[] {
    const list = Array.isArray(body) ? body : [body]
    return list.filter((item): item is BrevoEvent => typeof item === 'object' && item !== null && !Array.isArray(item))
}

function parseTags(event: BrevoEvent): unknown {
    if (Array.isArray(event.tags)) return event.tags
    if (typeof event.tag === 'string') {
        try {
            const parsed = JSON.parse(event.tag)
            return Array.isArray(parsed) ? parsed : [event.tag]
        } catch {
            return [event.tag]
        }
    }
    return []
}

/**
 * Maps one event onto what happens to the subscriber and the send row.
 *
 * - `hard_bounce`, `invalid_email` → `bounced`, from ANY mail: the address cannot receive
 *   mail, whichever mail found that out.
 * - `spam` → `complained`, only for newsletter mails (newsletter, test send, double
 *   opt-in). A complaint about a ticket or speaker mail says nothing about the newsletter.
 * - `unsubscribed` (Brevo's own unsubscribe) → `unsubscribed`, only for newsletter mails.
 * - `blocked` → no status change: Brevo did not send because the address is on its own
 *   blocklist, and the payload does not say why. Noted on the send row.
 * - `error` → no status change: Brevo could not process or send the mail, which says
 *   nothing about the address. Noted on the send row.
 * - `hard_bounce`, `invalid_email`, `blocked`, `error` on any OTHER mail (no newsletter marker) →
 *   additionally `mailFailure`, a Slack warning: a ticket confirmation or invoice did not
 *   arrive, and nobody else would notice.
 * - everything else (`soft_bounce`, `deferred`, `delivered`, opens, clicks, …) → ignored.
 *   A soft bounce is temporary; Brevo reports a hard bounce if it becomes permanent.
 */
export function decide(raw: BrevoEvent): Decision {
    const event = typeof raw.event === 'string' ? raw.event : ''
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
    const { isNewsletter, sendId } = parseNewsletterTracking(raw['X-Mailin-custom'], parseTags(raw))
    const reason = optionalString(raw.reason)
    const note = `Brevo: ${event}${reason ? ` (${reason})` : ''}`

    let transition: SubscriberTransition | null = null
    let noteSend = false
    switch (event) {
        case 'hard_bounce':
        case 'invalid_email':
            transition = 'bounced'
            noteSend = true
            break
        case 'spam':
            transition = isNewsletter ? 'complained' : null
            noteSend = true
            break
        case 'unsubscribed':
            transition = isNewsletter ? 'unsubscribed' : null
            noteSend = true
            break
        case 'blocked':
        case 'error':
            noteSend = true
            break
    }

    return {
        event,
        email,
        transition,
        sendId: noteSend ? sendId : null,
        note,
        isNewsletter,
        mailFailure: !isNewsletter && UNDELIVERED_EVENTS.has(event),
        reason,
        subject: optionalString(raw.subject),
        messageId: optionalString(raw['message-id']),
    }
}
