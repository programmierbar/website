/**
 * Marks newsletter mails so the Brevo webhook (`brevo-webhook`) can tell them apart from
 * every other mail the CMS and the website send through the same Brevo SMTP relay
 * (tickets, speaker portal, contact form, …). Brevo's transactional webhooks fire for all
 * of them, and a spam complaint about a ticket confirmation must not end a newsletter
 * subscription.
 *
 * Two headers, read by Brevo's SMTP relay:
 *
 * - `X-Mailin-custom` — Brevo echoes it verbatim as `X-Mailin-custom` in every webhook
 *   payload. This is the signal the webhook relies on. For a real send it carries the
 *   `newsletter_sends` id, so a bounce can be noted on the row that caused it.
 * - `X-Mailin-Tag` — becomes the mail's tag (`tags` in the payload), which also makes the
 *   mails filterable in the Brevo dashboard. The webhook accepts it as a second signal.
 *
 * Values: `newsletter:send:<send id>`, `newsletter:test`, `newsletter:double-opt-in`.
 */

export const TRACKING_PREFIX = 'newsletter'

export type NewsletterMailKind = 'send' | 'test' | 'double-opt-in'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Headers for one newsletter mail. `sendId` is the `newsletter_sends` row of a real send.
 * Never throws: the send job calls it after a row was claimed, where an exception would lose
 * the mail.
 */
export function buildNewsletterTrackingHeaders(kind: NewsletterMailKind, sendId?: string): Record<string, string> {
    const custom = kind === 'send' && sendId ? `${TRACKING_PREFIX}:send:${sendId}` : `${TRACKING_PREFIX}:${kind}`
    const tag = kind === 'send' ? TRACKING_PREFIX : `${TRACKING_PREFIX}-${kind}`
    return { 'X-Mailin-custom': custom, 'X-Mailin-Tag': tag }
}

export interface NewsletterTracking {
    /** The mail was a newsletter mail (real send, test send or double opt-in). */
    isNewsletter: boolean
    /** The `newsletter_sends` id of a real send, if present and well-formed. */
    sendId: string | null
}

/**
 * Reads the markers back from a webhook event. `custom` is the payload's `X-Mailin-custom`,
 * `tags` its `tags` array (or the stringified `tag` some events carry instead).
 */
export function parseNewsletterTracking(custom: unknown, tags: unknown): NewsletterTracking {
    const customValue = typeof custom === 'string' ? custom.trim() : ''
    const parts = customValue.split(':')
    const fromCustom = parts[0] === TRACKING_PREFIX

    let sendId: string | null = null
    if (fromCustom && parts[1] === 'send' && parts.length === 3 && UUID_RE.test(parts[2]!)) {
        sendId = parts[2]!.toLowerCase()
    }

    const tagList = Array.isArray(tags) ? tags : []
    const fromTags = tagList.some(
        (tag) => typeof tag === 'string' && (tag === TRACKING_PREFIX || tag.startsWith(`${TRACKING_PREFIX}-`))
    )

    return { isNewsletter: fromCustom || fromTags, sendId }
}
