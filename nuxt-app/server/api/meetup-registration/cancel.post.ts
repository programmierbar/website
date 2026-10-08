import { performMeetupRegistrationCancel, type MeetupRegistrationCancelResult } from '../../utils/meetupRegistration'

// JSON cancellation, called client-side by `pages/meetup/abmelden.vue`. POST, so
// mail scanners and link-expanders that follow the cancel link change nothing.
// Visitors without working JavaScript use the form POST in
// `server/routes/meetup/abmelden.post.ts`; both share the logic.
export default defineEventHandler(async (event): Promise<{ status: MeetupRegistrationCancelResult }> => {
    const body = await readBody(event)

    try {
        return { status: await performMeetupRegistrationCancel(body?.token) }
    } catch (err: any) {
        console.error('Meetup registration cancel error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Absage ist ein Fehler aufgetreten.',
        })
    }
})
