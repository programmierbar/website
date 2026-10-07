import { useDirectus } from '~/composables/useDirectus'
import { WEBSITE_URL } from '~/config'
import { buildIcsCalendar, getMeetupCalendarEvent } from 'shared-code'

// The .ics file behind the "Apple (.ics)" link in the confirmation mail and the
// calendar icon on the meetup page. Served by the website so the entry always
// reflects the current date and time in the CMS.
export default defineEventHandler(async (event) => {
    const slug = getRouterParam(event, 'slug')
    const meetup = slug ? await useDirectus().getMeetupBySlug(slug) : null
    if (!meetup) {
        throw createError({ statusCode: 404, message: 'Meetup nicht gefunden.' })
    }

    setResponseHeaders(event, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="programmierbar-meetup-${meetup.slug}.ics"`,
    })
    return buildIcsCalendar(getMeetupCalendarEvent(meetup, WEBSITE_URL))
})
