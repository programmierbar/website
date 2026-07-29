// Opting out has to work for everyone, so it is reachable two ways: the JSON
// route the page calls client-side, and the plain form POST the page renders for
// visitors without working JavaScript. Both must agree on what counts as an
// unusable link and on when a row is actually written, so the decision lives
// here once instead of in each handler.
//
// The token is the long-lived `unsubscribe_token`, not the confirm token: it
// never expires and stays valid after confirmation, because an unsubscribe link
// has to keep working for the life of the subscription.
export type NewsletterUnsubscribeResult = 'unsubscribed' | 'already_unsubscribed' | 'invalid'

/**
 * Opt one subscriber out by its unsubscribe token. Idempotent: re-clicking a
 * link is a no-op, and unknown tokens get a neutral result (no enumeration).
 *
 * Technical failures are thrown, not mapped — the callers differ in how they
 * report them (a 500 for the JSON route, a redirect for the form route).
 */
export async function performNewsletterUnsubscribe(token: unknown): Promise<NewsletterUnsubscribeResult> {
    // Checked here rather than in the handlers so an empty or malformed token
    // never reaches Directus, and 'invalid' means the same thing on both routes.
    if (typeof token !== 'string' || token.length === 0) {
        return 'invalid'
    }

    const directus = useAuthenticatedDirectus()
    const subscriber = await directus.readNewsletterSubscriberByUnsubscribeToken(token)

    // Unknown token → neutral, no detail.
    if (!subscriber) {
        return 'invalid'
    }

    // Already opted out → idempotent success (handles link re-clicks and mail
    // clients that follow links more than once).
    if (subscriber.status === 'unsubscribed') {
        return 'already_unsubscribed'
    }

    // Conditional on the state read above, so a concurrent request can't be
    // overwritten; when it reports no change we answer from the row's current
    // state — see the note on the guards in authenticatedDirectus.ts.
    const unsubscribed = await directus.unsubscribeNewsletterSubscriber(subscriber.id, token)
    if (unsubscribed) {
        return 'unsubscribed'
    }

    const current = await directus.readNewsletterSubscriberByUnsubscribeToken(token)
    return current?.status === 'unsubscribed' ? 'already_unsubscribed' : 'invalid'
}
