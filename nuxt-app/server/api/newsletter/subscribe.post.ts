import { NewsletterSignupSchema } from '../../utils/schema'

// Directus surfaces a unique-constraint violation as RECORD_NOT_UNIQUE inside
// the error body's `errors` array. Exported for unit testing.
export function isDuplicateError(err: any): boolean {
    const errors = err?.errors ?? err?.response?.errors
    return Array.isArray(errors) && errors.some((e: any) => e?.extensions?.code === 'RECORD_NOT_UNIQUE')
}

export default defineEventHandler(async (event) => {
    // Read the raw body once: the honeypot is checked before validation so we
    // never leak the form's shape to bots (mirrors /api/email).
    const rawBody = await readBody(event)

    // Bots fill hidden fields; humans don't. Return the same success shape a
    // real signup gets so a filled honeypot is indistinguishable from success.
    if (rawBody?.honeypot) {
        return { status: 'success' as const }
    }

    const parseResult = NewsletterSignupSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        throw createError({
            statusCode: 400,
            message: issue?.message ?? 'Deine E-Mail-Adresse scheint ungültig zu sein.',
        })
    }

    // Schema already trimmed; lower-case so the unique constraint dedupes
    // case-insensitively.
    const email = parseResult.data.email.toLowerCase()

    const directus = useAuthenticatedDirectus()

    try {
        // The website only captures the address. `status` defaults to
        // 'pending' in the collection, and the remaining NOT NULL columns
        // (signed_up_at, confirm_token, confirm_token_expires_at,
        // unsubscribe_token) are populated by a Directus `filter` hook on
        // `newsletter_subscribers.items.create` — it must run BEFORE the DB
        // write, so an `action` hook would be too late to satisfy the
        // constraints. That hook also owns sending the double-opt-in mail.
        await directus.createNewsletterSubscriber({ email })

        return { status: 'success' as const }
    } catch (err: any) {
        // `email` is UNIQUE: a repeat signup fails at insert instead of a
        // pre-check query. Return the SAME success response as a new signup so
        // the endpoint can't be used to probe whether an address is already
        // subscribed (email enumeration). No duplicate row is created, so no
        // second confirmation mail goes out.
        if (isDuplicateError(err)) {
            return { status: 'success' as const }
        }
        if (err.statusCode) {
            throw err
        }
        console.error('Newsletter signup error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Anmeldung ist ein Fehler aufgetreten.',
        })
    }
})
