import { TicketProfileSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body?.token) {
        throw createError({
            statusCode: 400,
            message: 'Token is required',
        })
    }

    if (!body?.data) {
        throw createError({
            statusCode: 400,
            message: 'Form data is required',
        })
    }

    // Validate form data with Zod
    const parseResult = TicketProfileSchema.safeParse(body.data)
    if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]
        throw createError({
            statusCode: 400,
            message: firstError?.message || 'Ungültige Formulardaten',
        })
    }
    const data = parseResult.data

    const directus = useAuthenticatedDirectus()

    try {
        // Validate token and get ticket
        const ticket = await directus.getTicketByProfileToken(body.token)

        if (!ticket) {
            throw createError({
                statusCode: 404,
                message: 'Ungültiger Token',
            })
        }

        // Check if already completed
        if (ticket.profile_status === 'completed') {
            throw createError({
                statusCode: 409,
                message: 'Bereits eingereicht',
            })
        }

        // Update ticket record with profile data
        await directus.updateTicket(ticket.id, {
            job_title: data.job_title,
            company: data.company,
            dietary_preferences: data.dietary_preferences || null,
            pronouns: data.pronouns || null,
            tshirt_size: data.tshirt_size || null,
            last_event_visited: data.last_event_visited || null,
            heard_about_from: data.heard_about_from || null,
            additional_notes: data.additional_notes || null,
            profile_status: 'completed',
            profile_token: null, // Invalidate token after submission
        })

        return {
            success: true,
            message: 'Angaben erfolgreich gespeichert',
        }
    } catch (err: any) {
        if (err.statusCode) {
            throw err
        }
        console.error('Ticket portal submission error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist beim Speichern deiner Angaben aufgetreten.',
        })
    }
})
