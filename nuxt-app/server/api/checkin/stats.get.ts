export default defineEventHandler(async (event) => {
    await requireDirectusUser(event)

    const directus = useAuthenticatedDirectus()

    let conference
    try {
        conference = await directus.getLatestConferenceWithTicketing()
    } catch (err: any) {
        throw createError({ statusCode: 500, message: `Failed to fetch conference: ${JSON.stringify(err?.errors || err?.message || err)}` })
    }

    if (!conference) {
        throw createError({ statusCode: 404, message: 'No conference with ticketing found' })
    }

    const [totalSold, checkedIn] = await Promise.all([
        directus.countPaidTicketsForConference(conference.id),
        directus.countCheckedInTicketsForConference(conference.id),
    ])

    return {
        conference: {
            id: conference.id,
            title: conference.title,
            slug: conference.slug,
        },
        totalSold,
        checkedIn,
    }
})
