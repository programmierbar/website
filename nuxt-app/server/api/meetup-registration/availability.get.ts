import { getMeetupRegistrationState } from 'shared-code'
import { getTurnstileSiteKey, issueFormToken } from '../../utils/formProtection'
import { getMeetupRegistrationScope, isUuid } from '../../utils/meetupRegistration'

// Called by the registration form on mount. Answers whether the meetup still
// takes registrations and hands out the form token the register route requires.
// Not cached: every response carries a fresh token, and "spots left" should be
// current. The meetup page itself stays ISR-cached.
export default defineEventHandler(async (event) => {
    const meetupId = getQuery(event).meetup
    if (!isUuid(meetupId)) {
        throw createError({ statusCode: 400, message: 'Meetup fehlt.' })
    }

    const directus = useAuthenticatedDirectus()
    const meetup = await directus.getMeetupRegistrationSettings(meetupId)
    if (!meetup) {
        throw createError({ statusCode: 404, message: 'Meetup nicht gefunden.' })
    }

    const { state, spotsLeft } = getMeetupRegistrationState(
        meetup,
        await directus.countPublicMeetupRegistrations(meetupId)
    )

    // A full meetup still accepts internal registrations (they don't count
    // against the public limit), so the form stays usable in that state.
    const acceptsRegistrations = state === 'open' || state === 'full'

    return {
        state,
        spotsLeft,
        formToken: acceptsRegistrations ? issueFormToken(getMeetupRegistrationScope(meetupId)) : null,
        turnstileSiteKey: acceptsRegistrations ? getTurnstileSiteKey() : null,
    }
})
