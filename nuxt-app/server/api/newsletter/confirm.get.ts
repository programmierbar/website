// Confirms a double-opt-in newsletter subscription from the link in the
// confirmation email. Idempotent: re-clicking a confirmed link is a no-op, and
// unknown / expired / non-pending tokens get neutral results (no enumeration).
export type NewsletterConfirmResult = 'confirmed' | 'already_confirmed' | 'expired' | 'invalid'

export default defineEventHandler(async (event): Promise<{ status: NewsletterConfirmResult }> => {
    const token = getQuery(event).token

    if (typeof token !== 'string' || token.length === 0) {
        return { status: 'invalid' }
    }

    try {
        const directus = useAuthenticatedDirectus()
        const subscriber = await directus.readNewsletterSubscriberByToken(token)

        // Unknown token → neutral, no detail.
        if (!subscriber) {
            return { status: 'invalid' }
        }

        // Already confirmed → idempotent success (handles link re-clicks).
        if (subscriber.status === 'confirmed') {
            return { status: 'already_confirmed' }
        }

        // Any other non-pending status (unsubscribed / bounced / complained) is
        // treated as an invalid link rather than confirmed.
        if (subscriber.status !== 'pending') {
            return { status: 'invalid' }
        }

        // Pending but past the confirmation window → offer a fresh signup.
        const expiresAt = new Date(subscriber.confirm_token_expires_at).getTime()
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            return { status: 'expired' }
        }

        await directus.confirmNewsletterSubscriber(subscriber.id)
        return { status: 'confirmed' }
    } catch (err: any) {
        console.error('Newsletter confirm error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Bestätigung ist ein Fehler aufgetreten.',
        })
    }
})
