// Shared pieces of the meetup registration routes: the form-token scope, error
// mapping from the CMS, and the cancel logic used by both the JSON route and the
// no-JS form route.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids and tokens are UUID columns; anything else would only make Postgres throw. */
export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Form tokens are bound to one meetup, so a token from another page is rejected. */
export function getMeetupRegistrationScope(meetupId: string) {
    return `meetup-registration:${meetupId}`
}

/** The `extensions.code` of the first error in a Directus SDK error, if any. */
export function getDirectusErrorCode(err: any): string | undefined {
    const errors = err?.errors ?? err?.response?.errors
    return Array.isArray(errors) ? errors[0]?.extensions?.code : undefined
}

export type MeetupRegistrationCancelResult = 'cancelled' | 'already_cancelled' | 'invalid'

/**
 * Cancel one registration by its permanent cancel token. Idempotent, and an
 * unknown token gets a neutral answer. Modeled on `performNewsletterUnsubscribe`.
 *
 * Technical failures are thrown; the JSON route answers 500, the form route
 * redirects to the error view.
 */
export async function performMeetupRegistrationCancel(token: unknown): Promise<MeetupRegistrationCancelResult> {
    if (!isUuid(token)) {
        return 'invalid'
    }

    const directus = useAuthenticatedDirectus()
    const registration = await directus.readMeetupRegistrationByCancelToken(token)
    if (!registration) {
        return 'invalid'
    }
    if (registration.status === 'cancelled') {
        return 'already_cancelled'
    }

    if (await directus.cancelMeetupRegistration(registration.id, token)) {
        return 'cancelled'
    }

    // Lost a race against a concurrent click: answer from the current state.
    const current = await directus.readMeetupRegistrationByCancelToken(token)
    return current?.status === 'cancelled' ? 'already_cancelled' : 'invalid'
}
