export default defineCachedEventHandler(
    async (event) => {
        setHeader(event, 'Access-Control-Allow-Origin', '*')
        setHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')

        const directus = useAuthenticatedDirectus()

        const conference = await directus.getLatestConferenceWithTicketing()

        if (!conference) {
            return {
                conference: {
                    id: null,
                    title: 'No active conference',
                    slug: null,
                },
                sold: 0,
                max: 0,
            }
        }

        const sold = await directus.countPaidTicketsForConference(conference.id)

        return {
            conference: {
                id: conference.id,
                title: conference.title,
                slug: conference.slug,
            },
            sold,
            max: conference.ticket_max_quantity ?? 0,
        }
    },
    {
        maxAge: 5 * 60,
        swr: true,
        getKey: () => 'stats:ticket-sales:current',
    }
)
