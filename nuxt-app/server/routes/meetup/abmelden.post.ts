import { performMeetupRegistrationCancel } from '../../utils/meetupRegistration'

// No-JavaScript cancellation for `pages/meetup/abmelden.vue`, same shape as the
// newsletter unsubscribe fallback: a plain form POST, answered POST → 303 → GET
// so the result renders from the query and a reload repeats nothing.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    let status: string
    try {
        status = await performMeetupRegistrationCancel(body?.token)
    } catch (err: any) {
        console.error('Meetup registration cancel (form) error:', err)
        status = 'error'
    }

    return await sendRedirect(event, `/meetup/abmelden?status=${status}`, 303)
})
