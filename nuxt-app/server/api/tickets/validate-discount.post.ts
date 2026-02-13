import { ValidateDiscountSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event)

    // Validate request body
    const parseResult = ValidateDiscountSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        const key = issue?.path?.[0] ?? 'input'
        const message = issue?.message ?? 'Validierungsfehler'
        throw createError({ statusCode: 400, message: `${key}: ${message}` })
    }

    const { code } = parseResult.data

    // Fetch settings from Directus
    let settings
    try {
        settings = await useAuthenticatedDirectus().getTicketSettings()
    } catch {
        return {
            valid: false,
            message: 'Ticketing ist derzeit nicht verfügbar.',
        }
    }

    // Check if code matches the configured discount code
    const isValid =
        settings.discount_code && code.toUpperCase() === settings.discount_code.toUpperCase()

    if (isValid) {
        // Calculate discount: difference between regular and discounted price
        const discountAmountCents = settings.regular_price_cents - settings.discounted_price_cents
        return {
            valid: true,
            discountAmountCents,
            message: 'Rabattcode erfolgreich angewendet!',
        }
    }

    return {
        valid: false,
        message: 'Ungültiger Rabattcode.',
    }
})
