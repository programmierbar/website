import type { DirectusTicketSettingsItem, TicketType } from '~/types/tickets'
import { getStripe } from '../../utils/stripe'
import { CreateCheckoutSchema } from '../../utils/ticketSchemas'
import { getTicketSettings, isEarlyBirdPeriod } from '../../utils/ticketSettings'

/**
 * Generate a unique order number
 */
function generateOrderNumber(): string {
    const year = new Date().getFullYear()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `ORD-${year}-${random}`
}

const VAT_RATE = 0.19

/**
 * Calculate pricing for the order (net prices + VAT)
 */
function calculatePricing(settings: DirectusTicketSettingsItem, ticketCount: number, discountValid: boolean) {
    const isEarlyBird = isEarlyBirdPeriod(settings)

    let unitPriceNetCents: number
    let ticketType: TicketType

    if (isEarlyBird) {
        unitPriceNetCents = settings.early_bird_price_cents
        ticketType = 'early_bird'
    } else if (discountValid) {
        unitPriceNetCents = settings.discounted_price_cents
        ticketType = 'discounted'
    } else {
        unitPriceNetCents = settings.regular_price_cents
        ticketType = 'regular'
    }

    const subtotalNetCents = ticketCount * unitPriceNetCents
    const discountAmountCents =
        discountValid && !isEarlyBird
            ? ticketCount * (settings.regular_price_cents - settings.discounted_price_cents)
            : 0
    const totalNetCents = subtotalNetCents

    // Calculate gross unit price for Stripe line items (round per-ticket for consistency)
    const unitPriceGrossCents = Math.round(unitPriceNetCents * (1 + VAT_RATE))

    // Calculate VAT and gross amounts from per-ticket gross to ensure consistency
    // This ensures ticketCount * unitPriceGrossCents === totalGrossCents
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

    const { conferenceId, purchaseType, purchaser, company, personalAddress, tickets, discountCode } = parseResult.data

    // Fetch ticket settings from Directus
    const settings = await getTicketSettings()
    if (!settings) {
        throw createError({
            statusCode: 503,
            message: 'Ticketing ist derzeit nicht verfügbar. Bitte versuche es später erneut.',
        })
    }

    // Validate discount code if provided
    const discountValid =
        discountCode && settings.discount_code
            ? discountCode.toUpperCase() === settings.discount_code.toUpperCase()
            : false

    // Calculate pricing
    const pricing = calculatePricing(settings, tickets.length, discountValid)

    const config = useRuntimeConfig()
    const directusUrl = config.public.directusCmsUrl || 'http://localhost:8055'
    const ticketToken = config.directusTicketToken

    if (!ticketToken) {
        console.error('DIRECTUS_TICKET_TOKEN not configured')
        throw createError({
            statusCode: 500,
            message: 'Serverkonfigurationsfehler',
        })
    }

    try {
        // Verify conference exists
        // Note: ticketing_enabled field is optional until schema is deployed to production
        const conferenceResponse = await fetch(
            `${directusUrl}/items/conferences/${conferenceId}?fields=id,slug,title`,
            {
                headers: {
                    Authorization: `Bearer ${ticketToken}`,
                },
            }
        )

        if (!conferenceResponse.ok) {
            throw createError({
                statusCode: 404,
                message: 'Konferenz nicht gefunden',
            })
        }

        const conferenceData = await conferenceResponse.json()
        const conference = conferenceData.data

        // TODO: Re-enable ticketing_enabled check once schema is deployed to production
        // if (!conference.ticketing_enabled) {
        //     throw createError({
        //         statusCode: 400,
        //         message: 'Ticketverkauf für diese Konferenz ist nicht aktiv',
        //     })
        // }

        // Generate order number
        const orderNumber = generateOrderNumber()

        // Create pending order in Directus
        // Note: We store net amounts in the database, VAT is calculated
        // For billing address: use company address for company purchases, or optional personal address
        const billingAddress = purchaseType === 'company' ? company?.address : personalAddress

        const orderPayload = {
            order_number: orderNumber,
            conference: conferenceId,
            status: 'pending',
            purchase_type: purchaseType,
            purchaser_first_name: purchaser.firstName,
            purchaser_last_name: purchaser.lastName,
            purchaser_email: purchaser.email,
            company_name: company?.name || null,
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
            discount_code_used: discountValid ? discountCode : null,
            ticket_type: pricing.ticketType,
            stripe_checkout_session_id: '', // Will be updated after creating Stripe session
        }

        const createOrderResponse = await fetch(`${directusUrl}/items/ticket_orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ticketToken}`,
            },
            body: JSON.stringify(orderPayload),
        })

        if (!createOrderResponse.ok) {
            const errorText = await createOrderResponse.text()
            console.error('Failed to create order:', errorText)
            throw createError({
                statusCode: 500,
                message: 'Fehler beim Erstellen der Bestellung',
            })
        }

        const orderData = await createOrderResponse.json()
        const orderId = orderData.data.id

        // Create Stripe Checkout Session
        const stripe = getStripe()
        const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000'

        let session
        try {
            session = await stripe.checkout.sessions.create({
                mode: 'payment',
                payment_method_types: ['card'],
                customer_email: purchaser.email,
                // Use gross prices (including 19% VAT) for Stripe
                line_items: tickets.map((ticket) => ({
                    price_data: {
                        currency: 'eur',
                        unit_amount: pricing.unitPriceGrossCents,
                        product_data: {
                            name: `${conference.title} - Ticket (inkl. 19% MwSt.)`,
                            description: `Teilnehmer: ${ticket.firstName} ${ticket.lastName}`,
                        },
                    },
                    quantity: 1,
                })),
                success_url: `${websiteUrl}/konferenzen/${conference.slug}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${websiteUrl}/konferenzen/${conference.slug}/tickets?cancelled=true`,
                metadata: {
                    order_id: orderId,
                    conference_id: conferenceId,
                    ticket_type: pricing.ticketType,
                    // Store attendee info for webhook processing
                    attendees: JSON.stringify(tickets),
                },
            })
        } catch (stripeErr: any) {
            // Stripe session creation failed - delete the pending order from Directus
            console.error('Stripe session creation failed:', stripeErr)
            try {
                await fetch(`${directusUrl}/items/ticket_orders/${orderId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${ticketToken}`,
                    },
                })
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
        await fetch(`${directusUrl}/items/ticket_orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ticketToken}`,
            },
            body: JSON.stringify({
                stripe_checkout_session_id: session.id,
            }),
        })

        return {
            checkoutUrl: session.url,
            orderId: orderId,
        }
    } catch (err: any) {
        if (err.statusCode) {
            throw err
        }
        console.error('Checkout creation error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist beim Erstellen der Bestellung aufgetreten.',
        })
    }
})
