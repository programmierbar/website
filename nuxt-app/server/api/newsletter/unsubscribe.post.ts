// Opts an address out of the newsletter. POST (not GET) because it changes
// state — the unsubscribe page reads the token from the email link and calls
// this client-side. Idempotent: re-clicking an unsubscribe link is a no-op, and
// unknown tokens get a neutral result (no enumeration).
//
// The token is the long-lived `unsubscribe_token`, not the confirm token: it
// never expires and stays valid after confirmation, because an unsubscribe link
// has to keep working for the life of the subscription.
export type NewsletterUnsubscribeResult = 'unsubscribed' | 'already_unsubscribed' | 'invalid'

export default defineEventHandler(async (event): Promise<{ status: NewsletterUnsubscribeResult }> => {
    const body = await readBody(event)
    const token = body?.token

    if (typeof token !== 'string' || token.length === 0) {
        return { status: 'invalid' }
    }

    try {
        const directus = useAuthenticatedDirectus()
        const subscriber = await directus.readNewsletterSubscriberByUnsubscribeToken(token)

        // Unknown token → neutral, no detail.
        if (!subscriber) {
            return { status: 'invalid' }
        }

        // Already opted out → idempotent success (handles link re-clicks and
        // mail clients that follow links more than once).
        if (subscriber.status === 'unsubscribed') {
            return { status: 'already_unsubscribed' }
        }

        // Conditional on the state read above, so a concurrent request can't
        // overwrite it; when it reports no change we answer from the row's
        // current state — see the note on the guards in authenticatedDirectus.ts.
        const unsubscribed = await directus.unsubscribeNewsletterSubscriber(subscriber.id, token)
        if (unsubscribed) {
            return { status: 'unsubscribed' }
        }

        const current = await directus.readNewsletterSubscriberByUnsubscribeToken(token)
        return { status: current?.status === 'unsubscribed' ? 'already_unsubscribed' : 'invalid' }
    } catch (err: any) {
        console.error('Newsletter unsubscribe error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Abmeldung ist ein Fehler aufgetreten.',
        })
    }
})
