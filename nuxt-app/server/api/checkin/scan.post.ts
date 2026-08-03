import { CheckinScanSchema } from '~/server/utils/schema'

export default defineEventHandler(async (event) => {
    await requireDirectusUser(event)

    // Validated the same way as every other route here, rather than via `h3-zod`'s
    // `useValidatedBody`. That package was last published in January 2024, pins `zod ^3`, and so
    // blocked Zod 4 for the sake of one call site — this one. The six sibling routes already used
    // `safeParse` + `createError`, so dropping it also removes the odd one out.
    const parseResult = CheckinScanSchema.safeParse(await readBody(event))
    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            message: parseResult.error.issues[0]?.message ?? 'Ungültiger Ticket-Code',
        })
    }
    const { ticketCode } = parseResult.data

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
