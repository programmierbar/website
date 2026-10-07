import { MEETUP_REGISTRATION_ERROR_CODES } from 'shared-code'
import { takeRateLimit, verifyFormToken, verifyTurnstile } from '../../utils/formProtection'
import { getDirectusErrorCode, getMeetupRegistrationScope } from '../../utils/meetupRegistration'
import { MeetupRegistrationSchema } from '../../utils/schema'

// Generous on purpose: colleagues registering from the office share one IP.
const RATE_LIMIT = { requests: 20, windowMs: 10 * 60 * 1000 }

const SUCCESS = { status: 'registered' as const }

const REJECTIONS: Record<string, { state: 'full' | 'closed'; message: string }> = {
    [MEETUP_REGISTRATION_ERROR_CODES.full]: {
        state: 'full',
        message: 'Das Meetup ist leider schon ausgebucht.',
    },
    [MEETUP_REGISTRATION_ERROR_CODES.closed]: {
        state: 'closed',
        message: 'Die Anmeldung für dieses Meetup ist geschlossen.',
    },
    [MEETUP_REGISTRATION_ERROR_CODES.disabled]: {
        state: 'closed',
        message: 'Die Anmeldung für dieses Meetup ist geschlossen.',
    },
}

/**
 * Registers someone for a meetup. Whether the meetup is open, full or closed,
 * whether the address is already registered and whether it is internal is
 * decided by the CMS hook inside the insert transaction — the one place that
 * can do it without races. This route only keeps spam out and validates input.
 */
export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event)

    // Bots that fill the rendered form trip the honeypot. They get the normal
    // success answer, so nothing tells them they were dropped.
    if (rawBody?.honeypot) {
        return SUCCESS
    }

    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    if (!takeRateLimit(`meetup-registration:${ip}`, RATE_LIMIT.requests, RATE_LIMIT.windowMs)) {
        throw createError({
            statusCode: 429,
            message: 'Zu viele Anmeldungen in kurzer Zeit. Bitte versuche es später erneut.',
        })
    }

    const parseResult = MeetupRegistrationSchema.safeParse(rawBody)
    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            message: parseResult.error.issues[0]?.message ?? 'Bitte überprüfe deine Angaben.',
        })
    }
    const { meetupId, ...input } = parseResult.data

    // Scripts posting straight to this route have no token: the honeypot cannot
    // catch them, this does. Humans only see this after a very fast submit or a
    // page left open for many hours.
    const tokenCheck = verifyFormToken(rawBody?.formToken, getMeetupRegistrationScope(meetupId))
    if (tokenCheck === 'too_fast') {
        throw createError({ statusCode: 400, message: 'Das ging schnell! Bitte sende das Formular noch einmal ab.' })
    }
    if (tokenCheck !== 'ok') {
        throw createError({
            statusCode: 400,
            message: 'Das Formular ist abgelaufen. Bitte lade die Seite neu und versuche es erneut.',
        })
    }

    if (!(await verifyTurnstile(event, rawBody?.turnstileToken))) {
        throw createError({
            statusCode: 400,
            message: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuche es erneut.',
        })
    }

    try {
        await useAuthenticatedDirectus().createMeetupRegistration({
            meetup: meetupId,
            full_name: input.full_name,
            email: input.email,
            pronouns: input.pronouns ?? null,
            role: input.role ?? null,
            company: input.company ?? null,
            heard_about_from: input.heard_about_from ?? null,
            heard_about_other: input.heard_about_other ?? null,
            has_meetup_account: input.has_meetup_account ?? null,
            wants_meetup_updates: input.wants_meetup_updates,
        })
        return SUCCESS
    } catch (err: any) {
        const code = getDirectusErrorCode(err)

        // Already registered: the CMS resent the confirmation mail. Same answer
        // as a new registration, so the form can't be used to probe addresses.
        if (code === MEETUP_REGISTRATION_ERROR_CODES.duplicate) {
            return SUCCESS
        }

        const rejection = code ? REJECTIONS[code] : undefined
        if (rejection) {
            throw createError({ statusCode: 409, message: rejection.message, data: { state: rejection.state } })
        }

        console.error('Meetup registration error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Anmeldung ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
        })
    }
})
