import type Stripe from 'stripe'
import { CreateCheckoutSchema } from '../../utils/schema'
import { getStripe } from '../../utils/stripe'
import { isEarlyBirdPeriod } from '../../utils/ticketSettings'
import { VAT_RATE, VAT_RATE_PERCENT } from '~/config'
import type { TicketType, DirectusTicketOrderItem } from '~/types/directus'
import type { TicketAttendee } from '~/types/items'
import type { CreateCheckoutInput } from '../../utils/schema'

function generateOrderNumber(): string {
    const year = new Date().getFullYear()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `ORD-${year}-${random}`
}

interface ConferencePricing {
    ticket_early_bird_price_cents: number | null
    ticket_regular_price_cents: number | null
    ticket_early_bird_deadline: string | null
}

function calculatePricing(
    conference: ConferencePricing,
    ticketCount: number,
    discountPriceCents: number | null
) {
    const isEarlyBird = isEarlyBirdPeriod(conference.ticket_early_bird_deadline)

    let unitPriceNetCents: number
    let ticketType: TicketType

    if (isEarlyBird && conference.ticket_early_bird_price_cents) {
        unitPriceNetCents = conference.ticket_early_bird_price_cents
        ticketType = 'early_bird'
    } else if (discountPriceCents !== null) {
        unitPriceNetCents = discountPriceCents
        ticketType = 'discounted'
    } else {
        unitPriceNetCents = conference.ticket_regular_price_cents ?? 0
        ticketType = 'regular'
    }

    const subtotalNetCents = ticketCount * unitPriceNetCents
    const regularPriceCents = conference.ticket_regular_price_cents ?? 0
    const discountAmountCents =
        discountPriceCents !== null && !isEarlyBird
            ? ticketCount * (regularPriceCents - discountPriceCents)
            : 0
    const totalNetCents = subtotalNetCents

    // Calculate gross unit price for Stripe line items (round per-ticket for consistency)
    const unitPriceGrossCents = Math.round(unitPriceNetCents * (1 + VAT_RATE))

    // Calculate VAT and gross amounts from per-ticket gross to ensure consistency
    const totalGrossCents = ticketCount * unitPriceGrossCents
    const vatAmountCents = totalGrossCents - totalNetCents

    return {
        unitPriceNetCents,
        unitPriceGrossCents,
        ticketType,
        subtotalNetCents,
        discountAmountCents,
        totalNetCents,
        vatAmountCents,
        totalGrossCents,
    }
}

function buildOrderPayload(
    input: CreateCheckoutInput,
    orderNumber: string,
    pricing: ReturnType<typeof calculatePricing>,
    discountCodeId: string | null
): Partial<DirectusTicketOrderItem> {
    const { conferenceId, purchaseType, purchaser, company, personalAddress } = input
    const billingAddress = purchaseType === 'company' ? company?.address : personalAddress

    return {
        order_number: orderNumber,
        conference: conferenceId,
        status: 'pending',
        purchase_type: purchaseType,
        purchaser_first_name: purchaser.firstName,
        purchaser_last_name: purchaser.lastName,
        purchaser_email: purchaser.email,
        company_name: company?.name || null,
        company_vat_id: company?.vatId || null,
        billing_address_line1: billingAddress?.line1 || null,
        billing_address_line2: billingAddress?.line2 || null,
        billing_city: billingAddress?.city || null,
        billing_postal_code: billingAddress?.postalCode || null,
        billing_country: billingAddress?.country || null,
        billing_email: company?.billingEmail || null,
        subtotal_cents: pricing.subtotalNetCents,
        discount_amount_cents: pricing.discountAmountCents,
        total_cents: pricing.totalNetCents,
        vat_amount_cents: pricing.vatAmountCents,
        total_gross_cents: pricing.totalGrossCents,
        discount_code_used: discountCodeId,
        ticket_type: pricing.ticketType,
        stripe_checkout_session_id: '', // Will be updated after creating Stripe session
    }
}

function buildStripeSessionParams(
    tickets: TicketAttendee[],
    pricing: ReturnType<typeof calculatePricing>,
    conferenceTitle: string,
    conferenceSlug: string,
    purchaserEmail: string,
    orderId: string,
    conferenceId: string
): Stripe.Checkout.SessionCreateParams {
    const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000'

    return {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: purchaserEmail,
        line_items: tickets.map((ticket) => ({
            price_data: {
                currency: 'eur',
                unit_amount: pricing.unitPriceGrossCents,
                product_data: {
                    name: `${conferenceTitle} - Ticket (inkl. ${VAT_RATE_PERCENT}% MwSt.)`,
                    description: `Teilnehmer: ${ticket.firstName} ${ticket.lastName}`,
                },
            },
            quantity: 1,
        })),
        success_url: `${websiteUrl}/konferenzen/${conferenceSlug}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${websiteUrl}/konferenzen/${conferenceSlug}/tickets?cancelled=true`,
        metadata: {
            order_id: orderId,
            conference_id: conferenceId,
            ticket_type: pricing.ticketType,
            attendees: JSON.stringify(tickets),
        },
    }
}

export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event)

    // Validate request body
    const parseResult = CreateCheckoutSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        const key = issue?.path?.[0] ?? 'input'
        const message = issue?.message ?? 'Validierungsfehler'
        throw createError({ statusCode: 400, message: `${key}: ${message}` })
    }

    const input = parseResult.data
    const directus = useAuthenticatedDirectus()

    try {
        // Verify conference exists and ticketing is enabled
        const conference = await directus.getConference(input.conferenceId)

        if (!conference.ticketing_enabled) {
            throw createError({
                statusCode: 400,
                message: 'Ticketverkauf für diese Konferenz ist nicht aktiv',
            })
        }

        // Hard limit check: count existing tickets and reject if limit would be exceeded
        if (conference.ticket_max_quantity !== null) {
            const existingTickets = await directus.countPaidTicketsForConference(input.conferenceId)
            if (existingTickets + input.tickets.length > conference.ticket_max_quantity) {
                const remaining = Math.max(0, conference.ticket_max_quantity - existingTickets)
                throw createError({
                    statusCode: 409,
                    message:
                        remaining === 0
                            ? 'Leider sind alle Tickets ausverkauft.'
                            : `Nur noch ${remaining} Ticket(s) verfügbar. Bitte reduziere die Anzahl.`,
                })
            }
        }

        // Validate discount code if provided
        let discountPriceCents: number | null = null
        let discountCodeId: string | null = null

        if (input.discountCode) {
            const discountCode = await directus.getDiscountCode(input.conferenceId, input.discountCode)
            if (discountCode) {
                // Check max_uses
                if (discountCode.max_uses !== null) {
                    const uses = await directus.countDiscountCodeUses(discountCode.id)
                    if (uses >= discountCode.max_uses) {
                        throw createError({
                            statusCode: 400,
                            message: 'Dieser Rabattcode wurde bereits zu oft verwendet.',
                        })
                    }
                }
                discountPriceCents = discountCode.price_cents
                discountCodeId = discountCode.id
            }
        }

        // Calculate pricing
        const pricing = calculatePricing(conference, input.tickets.length, discountPriceCents)

        const orderNumber = generateOrderNumber()
        const orderPayload = buildOrderPayload(input, orderNumber, pricing, discountCodeId)
        const order = await directus.createTicketOrder(orderPayload)
        const orderId = order.id
        const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000'

        // Free ticket: skip Stripe, mark as paid directly
        if (pricing.totalGrossCents === 0) {
            await directus.updateTicketOrder(orderId, {
                status: 'paid',
                date_paid: new Date().toISOString(),
                attendees_json: JSON.stringify(input.tickets),
            })

            return {
                checkoutUrl: `${websiteUrl}/konferenzen/${conference.slug}/tickets/success?order_id=${orderId}`,
                orderId,
            }
        }

        // Create Stripe Checkout Session
        const stripe = getStripe()
        const sessionParams = buildStripeSessionParams(
            input.tickets,
            pricing,
            conference.title,
            conference.slug,
            input.purchaser.email,
            orderId,
            input.conferenceId
        )

        let session
        try {
            session = await stripe.checkout.sessions.create(sessionParams)
        } catch (stripeErr: any) {
            console.error('Stripe session creation failed:', stripeErr)
            try {
                await directus.deleteTicketOrder(orderId)
                console.log(`Deleted orphaned order ${orderId} after Stripe failure`)
            } catch (deleteErr) {
                console.error('Failed to delete orphaned order:', deleteErr)
            }
            throw createError({
                statusCode: 500,
                message: 'Fehler beim Erstellen der Zahlungssitzung. Bitte versuche es erneut.',
            })
        }

        // Update order with Stripe session ID
        await directus.updateTicketOrder(orderId, {
            stripe_checkout_session_id: session.id,
        })

        return {
            checkoutUrl: session.url,
            orderId: orderId,
        }
    } catch (err: any) {
        if (err.statusCode) {
            throw err
        }
        if (err?.response?.status === 404) {
            throw createError({ statusCode: 404, message: 'Konferenz nicht gefunden' })
        }
        console.error('Checkout creation error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist beim Erstellen der Bestellung aufgetreten.',
        })
    }
})
