import { verifyWebhookSignature } from '../../utils/stripe'
import type Stripe from 'stripe'

/**
 * Stripe webhook handler for ticket purchases.
 *
 * This endpoint receives checkout.session.completed events from Stripe
 * and updates the order status in Directus. The Directus hook
 * (ticket-order-processing) handles ticket creation and email sending.
 */
export default defineEventHandler(async (event) => {
    // Get raw body for signature verification
    const rawBody = await readRawBody(event)
    if (!rawBody) {
        throw createError({ statusCode: 400, message: 'No request body' })
    }

    // Get Stripe signature header
    const signature = getHeader(event, 'stripe-signature')
    if (!signature) {
        throw createError({ statusCode: 400, message: 'Missing Stripe signature' })
    }

    let stripeEvent: Stripe.Event

    try {
        stripeEvent = verifyWebhookSignature(rawBody, signature)
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        throw createError({ statusCode: 400, message: 'Invalid signature' })
    }

    // Handle the event
    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object as Stripe.Checkout.Session

        const orderId = session.metadata?.order_id
        const attendeesJson = session.metadata?.attendees

        if (!orderId) {
            console.error('Missing order_id in checkout session metadata')
            throw createError({ statusCode: 400, message: 'Missing order_id' })
        }

        const directus = useAuthenticatedDirectus()

        try {
            const updatePayload: Record<string, unknown> = {
                status: 'paid',
                stripe_payment_intent_id: session.payment_intent,
                date_paid: new Date().toISOString(),
            }

            // Store attendees JSON for Directus hook to process
            if (attendeesJson) {
                updatePayload.attendees_json = attendeesJson
            }

            // Atomic idempotent update: only update if status is NOT already 'paid'.
            // The filter ensures duplicate webhooks don't re-process the order.
            const result = await directus.updateTicketOrder(orderId, updatePayload, {
                filter: { status: { _neq: 'paid' } },
            })

            if (!result) {
                console.log(`Order ${orderId} already marked as paid - skipping duplicate webhook`)
                return { received: true, message: 'Already processed' }
            }

            console.log(`Order ${orderId} marked as paid - Directus hook will process tickets and emails`)
        } catch (err: any) {
            console.error('Error processing checkout completion:', err)
            throw createError({ statusCode: 500, message: 'Error processing payment' })
        }
    }

    // Return 200 to acknowledge receipt
    return { received: true }
})
