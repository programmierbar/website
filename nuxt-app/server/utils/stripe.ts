import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

/**
 * Get the Stripe client instance.
 * Uses lazy initialization to avoid issues during build.
 */
export function getStripe(): Stripe {
    if (!stripeInstance) {
        const config = useRuntimeConfig()
        if (!config.stripeSecretKey) {
            throw new Error('NUXT_STRIPE_SECRET_KEY is not configured')
        }
        stripeInstance = new Stripe(config.stripeSecretKey)
    }
    return stripeInstance
}

/**
 * Verify a Stripe webhook signature.
 */
export function verifyWebhookSignature(
    body: string | Buffer,
    signature: string
): Stripe.Event {
    const config = useRuntimeConfig()
    if (!config.stripeWebhookSecret) {
        throw new Error('NUXT_STRIPE_WEBHOOK_SECRET is not configured')
    }
    return getStripe().webhooks.constructEvent(body, signature, config.stripeWebhookSecret)
}
