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

        const config = useRuntimeConfig()
        const directusUrl = config.public.directusCmsUrl || 'http://localhost:8055'
        const adminToken = config.directusAdminToken

        if (!adminToken) {
            console.error('DIRECTUS_ADMIN_TOKEN not configured')
            throw createError({ statusCode: 500, message: 'Server configuration error' })
        }

        try {
            // Atomic idempotent update: only update if status is NOT already 'paid'
            // This prevents race conditions from duplicate webhooks by using Directus
            // filter to ensure only pending orders are updated
            const updatePayload: Record<string, unknown> = {
                status: 'paid',
                stripe_payment_intent_id: session.payment_intent,
                date_paid: new Date().toISOString(),
            }

            // Store attendees JSON for Directus hook to process
            if (attendeesJson) {
                updatePayload.attendees_json = attendeesJson
            }

            // Use Directus filter to atomically update only if status != 'paid'
            // The filter ensures this is idempotent - duplicate webhooks won't re-process
            const filterParam = encodeURIComponent(JSON.stringify({ status: { _neq: 'paid' } }))
            const response = await fetch(
                `${directusUrl}/items/ticket_orders/${orderId}?filter=${filterParam}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${adminToken}`,
                    },
                    body: JSON.stringify(updatePayload),
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error('Failed to update order:', errorText)
                throw createError({ statusCode: 500, message: 'Failed to update order' })
            }

            // Check if the update actually modified the record
            // Directus returns the updated item, or null/empty if filter didn't match
            const result = await response.json()
            if (!result.data) {
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
