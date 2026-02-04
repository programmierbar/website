import { getTicketSettings } from '../../utils/ticketSettings'

export default defineEventHandler(async () => {
    const settings = await getTicketSettings()

    // Return null if settings unavailable (e.g., schema not deployed yet)
    // The frontend handles this gracefully
    if (!settings) {
        return null
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
