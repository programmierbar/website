import { getTicketSettings } from '../../utils/ticketSettings'

export default defineEventHandler(async () => {
    const settings = await getTicketSettings()

    if (!settings) {
        throw createError({
            statusCode: 500,
            message: 'Konnte Ticket-Einstellungen nicht laden',
        })
    }

    // Return in snake_case format matching the store's expected interface
    // Note: discount_code is intentionally excluded from public API response
    return {
        early_bird_price_cents: settings.early_bird_price_cents,
        regular_price_cents: settings.regular_price_cents,
        discounted_price_cents: settings.discounted_price_cents,
        early_bird_deadline: settings.early_bird_deadline,
        discount_code: null, // Not exposed publicly for security
    }
})
