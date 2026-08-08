import Stripe from 'stripe'

// Pin the Stripe API version explicitly. Without this the SDK sends whichever version it happens to
// bundle, so upgrading the library silently moves checkout and webhooks onto a different API version —
// a payment-behaviour change disguised as a dependency bump.
//
// Keep this value and the `stripe` dependency as separate decisions: changing it is an API migration
// that needs the Stripe changelog read against the params in `tickets/create-checkout.post.ts`, not
// something to carry along with an npm update.
//
// The cast is required and deliberate. `apiVersion` is typed as the single literal the installed SDK
// bundles, so pinning any other version cannot type-check — the SDK is on `2026-07-29.dahlia` while we
// deliberately still talk `2026-02-25.clover`. The cost is that TypeScript no longer rejects a
// nonsense version string here, so treat this line as hand-checked against Stripe's changelog.
export const STRIPE_API_VERSION = '2026-02-25.clover' as Stripe.LatestApiVersion

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
        stripeInstance = new Stripe(config.stripeSecretKey, { apiVersion: STRIPE_API_VERSION })
    }
    return stripeInstance
}

/**
 * Verify a Stripe webhook signature.
 */
export function verifyWebhookSignature(body: string | Buffer, signature: string): Stripe.Event {
    const config = useRuntimeConfig()
    if (!config.stripeWebhookSecret) {
        throw new Error('NUXT_STRIPE_WEBHOOK_SECRET is not configured')
    }
    return getStripe().webhooks.constructEvent(body, signature, config.stripeWebhookSecret)
}
