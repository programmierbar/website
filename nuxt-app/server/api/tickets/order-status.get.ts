export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const sessionId = query.session_id as string
    const orderId = query.order_id as string

    if (!sessionId && !orderId) {
        throw createError({
            statusCode: 400,
            message: 'session_id or order_id is required',
        })
    }

    try {
        const directus = useAuthenticatedDirectus()

        const order = orderId
            ? await directus.getTicketOrder(orderId)
            : await directus.getTicketOrderBySessionId(sessionId)

        if (!order) {
            return { ready: false, ticketCount: 0 }
        }

        if (order.status !== 'paid') {
            return { ready: false, ticketCount: 0 }
        }

        const tickets = await directus.getTicketsByOrderId(order.id)

        if (!tickets || tickets.length === 0) {
            return { ready: false, ticketCount: 0 }
        }

        const result: { ready: boolean; ticketCount: number; profileUrl?: string } = {
            ready: true,
            ticketCount: tickets.length,
        }

        // For single ticket, include the profile URL so the success page can show a button
        if (tickets.length === 1 && tickets[0].profile_token && tickets[0].profile_status === 'pending') {
            result.profileUrl = `/ticket-portal?token=${encodeURIComponent(tickets[0].profile_token)}`
        }

        return result
    } catch (err: any) {
        if (err.statusCode) {
            throw err
        }
        console.error('Order status check error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist aufgetreten.',
        })
    }
})
