import { useValidatedBody } from 'h3-zod'
import { CheckinScanSchema } from '~/server/utils/schema'

export default defineEventHandler(async (event) => {
    await requireDirectusUser(event)

    const { ticketCode } = await useValidatedBody(event, CheckinScanSchema)

    const directus = useAuthenticatedDirectus()

    const conference = await directus.getLatestConferenceWithTicketing()
    if (!conference) {
        throw createError({ statusCode: 404, message: 'No conference with ticketing found' })
    }

    let ticket
    try {
        ticket = await directus.getTicketByCode(ticketCode)
    } catch (err: any) {
        throw createError({ statusCode: 500, message: `Failed to look up ticket: ${JSON.stringify(err?.errors || err?.message || err)}` })
    }

    if (!ticket) {
        throw createError({ statusCode: 404, message: 'Ticket not found' })
    }

    if (ticket.conference !== conference.id) {
        throw createError({ statusCode: 400, message: 'Ticket belongs to a different conference' })
    }

    if (ticket.status === 'cancelled') {
        throw createError({ statusCode: 400, message: 'Ticket is cancelled' })
    }

    if (ticket.status === 'checked_in') {
        return {
            alreadyCheckedIn: true,
            firstName: ticket.attendee_first_name,
            lastName: ticket.attendee_last_name,
            checkedInAt: ticket.checked_in_at,
        }
    }

    try {
        await directus.updateTicket(ticket.id, {
            status: 'checked_in',
            checked_in_at: new Date().toISOString(),
        } as any)
    } catch (err: any) {
        throw createError({ statusCode: 500, message: `Failed to update ticket: ${JSON.stringify(err?.errors || err?.message || err)}` })
    }

    return {
        alreadyCheckedIn: false,
        firstName: ticket.attendee_first_name,
        lastName: ticket.attendee_last_name,
    }
})
