export default defineCachedEventHandler(
    async (event) => {
        setHeader(event, 'Access-Control-Allow-Origin', '*')
        setHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')

        const directus = useAuthenticatedDirectus()

        const conference = await directus.getLatestConferenceWithTicketing()

        if (!conference) {
            throw createError({ statusCode: 404, message: 'No conference with ticketing found' })
        }

        const sold = await directus.countPaidTicketsForConference(conference.id)

        return {
            conference: {
                id: conference.id,
                title: conference.title,
                slug: conference.slug,
            },
            sold,
            max: conference.ticket_max_quantity ?? null,
        }
    },
    {
        maxAge: 5 * 60,
        swr: true,
        getKey: () => 'stats:ticket-sales:current',
    }
)
