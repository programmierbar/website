import { TicketAvailabilityQuerySchema } from '../../utils/schema'
import { getRemainingTicketCapacity } from '../../utils/ticketSettings'

// Read by the conference page and the ticket page to show the sold-out state.
// Not cached: the ticket page renders per request and must flip as soon as the
// last ticket is sold. The checkout route enforces the same limit on its own,
// so this only drives what visitors see.
export default defineEventHandler(async (event) => {
    const parseResult = TicketAvailabilityQuerySchema.safeParse(getQuery(event))
    if (!parseResult.success) {
        throw createError({ statusCode: 400, message: 'Ungültige Konferenz-ID.' })
    }

    const directus = useAuthenticatedDirectus()

    try {
        const conference = await directus.getConference(parseResult.data.conferenceId)
        const remaining = await getRemainingTicketCapacity(directus, conference)
        return { soldOut: remaining === 0 }
    } catch (err: any) {
        if (err?.response?.status === 404) {
            throw createError({ statusCode: 404, message: 'Konferenz nicht gefunden' })
        }
        console.error('Ticket availability lookup failed:', err)
        throw createError({ statusCode: 500, message: 'Ticketverfügbarkeit konnte nicht geladen werden.' })
    }
})
