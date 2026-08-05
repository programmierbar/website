import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { STRIPE_API_VERSION } from '../server/utils/stripe'

// Covers the one Stripe failure mode that is silent. `tickets/webhook.post.ts` is how a paid order
// becomes a fulfilled order, so if signature verification stops working the site keeps taking money
// and stops issuing tickets — no error a visitor or a gate would see.
//
// Written when moving the SDK 20 -> 22, because SDK 21 added "throw an error when using the wrong
// webhook parsing method": there are now two variants, `constructEvent` (synchronous, Node crypto)
// and `constructEventAsync` (for async providers such as Web Crypto on edge runtimes). We call the
// synchronous one. These tests fail if that stops being the right choice.
//
// No network and no real keys: `generateTestHeaderString` is Stripe's own helper for signing a
// payload with a known secret.

const SECRET = 'whsec_test_secret_do_not_use'

// Constructed the same way `getStripe()` does, against the same pinned version, so a version the SDK
// rejects would fail here rather than in production.
const stripe = new Stripe('sk_test_dummy_key_not_used_for_signing', { apiVersion: STRIPE_API_VERSION })

const EVENT = JSON.stringify({
    id: 'evt_test',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_123', object: 'checkout.session', metadata: { order_id: 'order-1' } } },
})

const sign = (payload: string, secret = SECRET, timestamp?: number) =>
    stripe.webhooks.generateTestHeaderString({ payload, secret, ...(timestamp === undefined ? {} : { timestamp }) })

describe('Stripe webhook signature verification', () => {
    it('accepts a correctly signed payload and returns the parsed event', () => {
        const event = stripe.webhooks.constructEvent(EVENT, sign(EVENT), SECRET)

        expect(event.type).toBe('checkout.session.completed')
        // The webhook handler reads `data.object` as a Checkout.Session and keys off metadata.order_id.
        expect((event.data.object as Stripe.Checkout.Session).metadata?.order_id).toBe('order-1')
    })

    it('rejects a payload that was modified after signing', () => {
        const signature = sign(EVENT)
        const tampered = EVENT.replace('order-1', 'order-2')

        expect(() => stripe.webhooks.constructEvent(tampered, signature, SECRET)).toThrow(
            Stripe.errors.StripeSignatureVerificationError
        )
    })

    it('rejects a signature made with a different secret', () => {
        const signature = sign(EVENT, 'whsec_someone_elses_secret')

        expect(() => stripe.webhooks.constructEvent(EVENT, signature, SECRET)).toThrow(
            Stripe.errors.StripeSignatureVerificationError
        )
    })

    it('rejects a signature older than the replay tolerance', () => {
        // Default tolerance is 5 minutes; 10 minutes ago must not pass.
        const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600
        const signature = sign(EVENT, SECRET, tenMinutesAgo)

        expect(() => stripe.webhooks.constructEvent(EVENT, signature, SECRET)).toThrow(
            Stripe.errors.StripeSignatureVerificationError
        )
    })

    it('accepts a Buffer body, which is what the raw request provides', () => {
        const buffer = Buffer.from(EVENT, 'utf8')
        const event = stripe.webhooks.constructEvent(buffer, sign(EVENT), SECRET)

        expect(event.id).toBe('evt_test')
    })
})

// The second half of the payment path. SDK 22 refactored how method arguments are parsed — params
// first, options second, no mixing, no callbacks — so these assert that a checkout session request
// still goes out with the fields it is supposed to carry.
//
// No network: Stripe's own `createFetchHttpClient` takes a fetch implementation, so the request can be
// captured and inspected instead of sent.
describe('Stripe checkout session request', () => {
    const capture = async (params: Stripe.Checkout.SessionCreateParams) => {
        let sent: { url: string; body: string; headers: Record<string, string> } | undefined

        const fakeFetch = (async (url: string, init: RequestInit) => {
            sent = {
                url: String(url),
                body: decodeURIComponent(String(init.body)),
                headers: Object.fromEntries(new Headers(init.headers).entries()),
            }
            return new Response(JSON.stringify({ id: 'cs_test_captured', object: 'checkout.session' }), {
                status: 200,
                headers: { 'content-type': 'application/json', 'request-id': 'req_test' },
            })
        }) as unknown as typeof fetch

        const client = new Stripe('sk_test_dummy_key_not_used_for_signing', {
            apiVersion: STRIPE_API_VERSION,
            httpClient: Stripe.createFetchHttpClient(fakeFetch),
        })

        const session = await client.checkout.sessions.create(params)
        return { session, sent: sent! }
    }

    // The shape `buildStripeSessionParams` produces. That function is module-private, so this mirrors
    // its output rather than importing it — the risk being tested is SDK argument handling, not our
    // pricing arithmetic, which is typed.
    const PARAMS: Stripe.Checkout.SessionCreateParams = {
        mode: 'payment',
        customer_email: 'purchaser@example.com',
        line_items: [
            {
                price_data: {
                    currency: 'eur',
                    unit_amount: 19900,
                    product_data: { name: 'Conference - Ticket (inkl. 19% MwSt.)', description: 'Teilnehmer: A B' },
                },
                quantity: 1,
            },
        ],
        success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://example.com/cancel',
        metadata: { order_id: 'order-1', conference_id: 'conf-1', ticket_type: 'regular' },
    }

    it('sends the pinned API version, not the SDK default', async () => {
        const { sent } = await capture(PARAMS)

        // The whole point of pinning: the SDK bundles 2026-07-29.dahlia, and the wire must still say
        // clover. If this ever reads dahlia, the API version moved without anyone deciding to move it.
        expect(sent.headers['stripe-version']).toBe(STRIPE_API_VERSION)
        expect(sent.headers['stripe-version']).toBe('2026-02-25.clover')
    })

    it('is a pin that does work: without it the SDK would send a different version', async () => {
        // Negative control. Without this, the assertion above cannot tell "the pin is honoured" from
        // "the SDK sends clover anyway", which would make it vacuous. If this ever fails, the SDK's own
        // default has caught up with the pinned value and the pin has become a no-op.
        let sentVersion: string | undefined
        const fakeFetch = (async (_url: string, init: RequestInit) => {
            sentVersion = new Headers(init.headers).get('stripe-version') ?? undefined
            return new Response(JSON.stringify({ id: 'cs_x', object: 'checkout.session' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }) as unknown as typeof fetch

        const unpinned = new Stripe('sk_test_dummy_key_not_used_for_signing', {
            httpClient: Stripe.createFetchHttpClient(fakeFetch),
        })
        await unpinned.checkout.sessions.create(PARAMS)

        expect(sentVersion).toBeDefined()
        expect(sentVersion).not.toBe(STRIPE_API_VERSION)
    })

    it('posts to the checkout sessions endpoint with the amount, currency and metadata intact', async () => {
        const { session, sent } = await capture(PARAMS)

        expect(sent.url).toContain('/v1/checkout/sessions')
        expect(sent.body).toContain('mode=payment')
        expect(sent.body).toContain('customer_email=purchaser@example.com')
        expect(sent.body).toContain('line_items[0][price_data][unit_amount]=19900')
        expect(sent.body).toContain('line_items[0][price_data][currency]=eur')
        expect(sent.body).toContain('line_items[0][quantity]=1')
        // The webhook keys off this to mark the order paid, so a serialisation change here would take
        // payments and never fulfil them.
        expect(sent.body).toContain('metadata[order_id]=order-1')
        expect(session.id).toBe('cs_test_captured')
    })

    it('keeps the {CHECKOUT_SESSION_ID} placeholder unescaped for Stripe to substitute', async () => {
        const { sent } = await capture(PARAMS)

        expect(sent.body).toContain('success_url=https://example.com/success?session_id={CHECKOUT_SESSION_ID}')
    })
})
