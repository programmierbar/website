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

    const { code, conferenceId } = parseResult.data

    const directus = useAuthenticatedDirectus()

    // Look up discount code for this conference
    let discountCode
    try {
        discountCode = await directus.getDiscountCode(conferenceId, code)
    } catch (err: any) {
        console.error('Error looking up discount code:', err?.message || err)
        return {
            valid: false,
            message: 'Ticketing ist derzeit nicht verfügbar.',
        }
    }

    if (!discountCode) {
        return {
            valid: false,
            message: 'Ungültiger Rabattcode.',
        }
    }

    // Check max_uses limit
    if (discountCode.max_uses !== null) {
        const uses = await directus.countDiscountCodeUses(discountCode.id)
        if (uses >= discountCode.max_uses) {
            return {
                valid: false,
                message: 'Dieser Rabattcode wurde bereits zu oft verwendet.',
            }
        }
    }

    // Get conference regular price to calculate discount amount
    const conference = await directus.getConference(conferenceId)
    const regularPriceCents = conference.ticket_regular_price_cents ?? 0
    const discountAmountCents = regularPriceCents - discountCode.price_cents

    return {
        valid: true,
        discountPriceCents: discountCode.price_cents,
        discountLabel: discountCode.label,
        discountAmountCents,
        message: 'Rabattcode erfolgreich angewendet!',
    }
})
