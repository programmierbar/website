// Confirms a double-opt-in newsletter subscription. POST (not GET) because it
// changes state — the confirm page reads the token from the email link and
// calls this client-side. Idempotent: re-confirming is a no-op, and
// unknown / expired / non-pending tokens get neutral results (no enumeration).
export type NewsletterConfirmResult = 'confirmed' | 'already_confirmed' | 'resent' | 'invalid'

export default defineEventHandler(async (event): Promise<{ status: NewsletterConfirmResult }> => {
    const body = await readBody(event)
    const token = body?.token

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

        // Pending but past the confirmation window → don't leave the address
        // stuck. Rotate the token; the CMS stamps a fresh window and resends the
        // confirmation mail. (Re-signup hits the duplicate branch and can't
        // resend, so recovery has to happen here.)
        //
        // Both writes below are conditional on the state read above, so a
        // concurrent request (a double-clicked link, a retry) that got there
        // first cannot be overwritten. When that happens the write reports no
        // change and we answer from the row's current state rather than from our
        // own read — see the note on the guards in authenticatedDirectus.ts.
        const expiresAt = new Date(subscriber.confirm_token_expires_at).getTime()
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            const refreshed = await directus.refreshNewsletterConfirmation(subscriber.id, token)
            if (refreshed) {
                return { status: 'resent' }
            }

            // Someone else rotated the token first: our token no longer resolves,
            // and their mail is already on its way — 'resent' stays honest, and
            // no second mail is sent.
            const current = await directus.readNewsletterSubscriberByToken(token)
            if (!current) {
                return { status: 'resent' }
            }

            return { status: current.status === 'confirmed' ? 'already_confirmed' : 'invalid' }
        }

        const confirmed = await directus.confirmNewsletterSubscriber(subscriber.id, token)
        if (confirmed) {
            return { status: 'confirmed' }
        }

        // Lost the race: a concurrent confirm, or a status change (unsubscribe)
        // that we must not overwrite.
        const current = await directus.readNewsletterSubscriberByToken(token)
        return { status: current?.status === 'confirmed' ? 'already_confirmed' : 'invalid' }
    } catch (err: any) {
        console.error('Newsletter confirm error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Bestätigung ist ein Fehler aufgetreten.',
        })
    }
})
