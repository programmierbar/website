// Confirming a double-opt-in subscription is reachable two ways: the JSON route
// the page calls client-side, and the plain form POST the page renders for
// visitors without working JavaScript. Both must agree on what counts as an
// unusable link and on how a lost race is answered, so the decision lives here
// once instead of in each handler.
export type NewsletterConfirmResult = 'confirmed' | 'already_confirmed' | 'resent' | 'invalid'

/**
 * Confirm one subscriber by its confirm token. Idempotent: re-confirming is a
 * no-op, and unknown / expired / non-pending tokens get neutral results (no
 * enumeration).
 *
 * Technical failures are thrown, not mapped — the callers differ in how they
 * report them (a 500 for the JSON route, a redirect for the form route).
 */
export async function performNewsletterConfirm(token: unknown): Promise<NewsletterConfirmResult> {
    // Checked here rather than in the handlers so an empty or malformed token
    // never reaches Directus, and 'invalid' means the same thing on both routes.
    if (typeof token !== 'string' || token.length === 0) {
        return 'invalid'
    }

    const directus = useAuthenticatedDirectus()
    const subscriber = await directus.readNewsletterSubscriberByToken(token)

    // Unknown token → neutral, no detail.
    if (!subscriber) {
        return 'invalid'
    }

    // Already confirmed → idempotent success (handles link re-clicks).
    if (subscriber.status === 'confirmed') {
        return 'already_confirmed'
    }

    // Any other non-pending status (unsubscribed / bounced / complained) is
    // treated as an invalid link rather than confirmed.
    if (subscriber.status !== 'pending') {
        return 'invalid'
    }

    // Pending but past the confirmation window → don't leave the address stuck.
    // Rotate the token; the CMS stamps a fresh window and resends the
    // confirmation mail. (Re-signup hits the duplicate branch and can't resend,
    // so recovery has to happen here.)
    //
    // Both writes below are conditional on the state read above, so a concurrent
    // request (a double-clicked link, a retry, two tabs) that got there first
    // cannot be overwritten. When that happens the write reports no change and we
    // answer from the row's current state rather than from our own read — see the
    // note on the guards in authenticatedDirectus.ts.
    const expiresAt = new Date(subscriber.confirm_token_expires_at).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        const refreshed = await directus.refreshNewsletterConfirmation(subscriber.id, token)
        if (refreshed) {
            return 'resent'
        }

        // Someone else rotated the token first: our token no longer resolves, and
        // their mail is already on its way — 'resent' stays honest, and no second
        // mail is sent.
        const current = await directus.readNewsletterSubscriberByToken(token)
        if (!current) {
            return 'resent'
        }

        return current.status === 'confirmed' ? 'already_confirmed' : 'invalid'
    }

    const confirmed = await directus.confirmNewsletterSubscriber(subscriber.id, token)
    if (confirmed) {
        return 'confirmed'
    }

    // Lost the race: a concurrent confirm, or a status change (unsubscribe) that
    // we must not overwrite.
    const current = await directus.readNewsletterSubscriberByToken(token)
    return current?.status === 'confirmed' ? 'already_confirmed' : 'invalid'
}
