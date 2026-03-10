export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const token = query.token as string

    if (!token) {
        throw createError({
            statusCode: 400,
            message: 'Token is required',
        })
    }

    try {
        const directus = useAuthenticatedDirectus()
        const ticket = await directus.getTicketByProfileToken(token)

        if (!ticket) {
            throw createError({
                statusCode: 404,
                message: 'Ungültiger Token. Bitte überprüfe deinen Link.',
            })
        }

        // Check if already completed
        if (ticket.profile_status === 'completed') {
            throw createError({
                statusCode: 409,
                message: 'Deine Angaben wurden bereits eingereicht.',
            })
        }

        // Fetch conference title for display
        const conference = await directus.getConference(ticket.conference)

        return {
            ticket: {
                id: ticket.id,
                attendee_first_name: ticket.attendee_first_name,
                attendee_last_name: ticket.attendee_last_name,
                attendee_email: ticket.attendee_email,
                conference_title: conference?.title ?? '',
                job_title: ticket.job_title,
                company: ticket.company,
                dietary_preferences: ticket.dietary_preferences,
                pronouns: ticket.pronouns,
                tshirt_size: ticket.tshirt_size,
                last_event_visited: ticket.last_event_visited,
                heard_about_from: ticket.heard_about_from,
                additional_notes: ticket.additional_notes,
            },
        }
    } catch (err: any) {
        if (err.statusCode) {
            throw err
        }
        console.error('Ticket portal validation error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist bei der Überprüfung deines Zugangs aufgetreten.',
        })
    }
})
