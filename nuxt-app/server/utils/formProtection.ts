import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

// Spam protection for public forms that trigger mails, without a third-party
// account. A honeypot alone only stops bots that fill the rendered form: a
// script that posts straight to the JSON route simply leaves the field out and
// passes as human. So the form additionally has to present a token the server
// issued earlier, which proves the page was loaded and lets us enforce a
// minimum fill time. Optionally (when keys are configured) Cloudflare Turnstile
// is checked on top.

// Faster than this is not a human typing a name and an email address.
export const FORM_TOKEN_MIN_AGE_MS = 3 * 1000
// Long enough for a tab that was left open for an afternoon.
export const FORM_TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000

export type FormTokenCheck = 'ok' | 'missing' | 'invalid' | 'too_fast' | 'expired'

// Derived from the Directus API token, which is already the server's one secret,
// so this needs no extra configuration — and fails loudly the same way when it
// is missing. Rotating the API token invalidates open forms, nothing more.
function getSigningKey() {
    const apiToken = useRuntimeConfig().directusApiToken
    if (!apiToken) {
        throw createError({ statusCode: 500, message: 'NUXT_DIRECTUS_API_TOKEN not configured' })
    }
    return createHmac('sha256', apiToken).update('form-token-v1').digest()
}

function sign(payload: string) {
    return createHmac('sha256', getSigningKey()).update(payload).digest('base64url')
}

/**
 * Issue a token for one form (`scope`, e.g. `meetup-registration:<meetupId>`).
 * Format: `<issuedAtMs>.<nonce>.<signature>`.
 */
export function issueFormToken(scope: string, now = Date.now()) {
    const payload = `${now}.${randomBytes(9).toString('base64url')}`
    return `${payload}.${sign(`${scope}|${payload}`)}`
}

export function verifyFormToken(token: unknown, scope: string, now = Date.now()): FormTokenCheck {
    if (typeof token !== 'string' || token === '') {
        return 'missing'
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
        return 'invalid'
    }
    const [issuedAt, nonce, signature] = parts as [string, string, string]

    const expected = Buffer.from(sign(`${scope}|${issuedAt}.${nonce}`))
    const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return 'invalid'
    }

    const age = now - Number(issuedAt)
    if (!Number.isFinite(age) || age < 0) {
        return 'invalid'
    }
    if (age < FORM_TOKEN_MIN_AGE_MS) {
        return 'too_fast'
    }
    if (age > FORM_TOKEN_MAX_AGE_MS) {
        return 'expired'
    }
    return 'ok'
}

// Best effort: the window lives in the memory of one server instance, so on
// Vercel each instance counts on its own. It still caps what a single source can
// fire at one instance, which is the cheap part of the problem.
const rateLimitWindows = new Map<string, { count: number; resetAt: number }>()

/** Returns false once `key` has used up `limit` requests within `windowMs`. */
export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
    // Drop expired windows so the map cannot grow without bound.
    if (rateLimitWindows.size > 10_000) {
        for (const [entryKey, entry] of rateLimitWindows) {
            if (entry.resetAt <= now) rateLimitWindows.delete(entryKey)
        }
    }

    const entry = rateLimitWindows.get(key)
    if (!entry || entry.resetAt <= now) {
        rateLimitWindows.set(key, { count: 1, resetAt: now + windowMs })
        return true
    }
    entry.count += 1
    return entry.count <= limit
}

/** Test helper. */
export function resetRateLimits() {
    rateLimitWindows.clear()
}

/** The site key for the browser, or null when Turnstile is not configured. */
export function getTurnstileSiteKey(): string | null {
    const config = useRuntimeConfig()
    return config.turnstileSecretKey && config.public.turnstileSiteKey ? config.public.turnstileSiteKey : null
}

/**
 * Verify a Cloudflare Turnstile response. Only enforced when both keys are set
 * (NUXT_TURNSTILE_SECRET_KEY, NUXT_PUBLIC_TURNSTILE_SITE_KEY); without them it
 * is off and the form works with the checks above alone.
 */
export async function verifyTurnstile(event: H3Event, token: unknown): Promise<boolean> {
    const config = useRuntimeConfig()
    if (!getTurnstileSiteKey()) {
        return true
    }
    if (typeof token !== 'string' || token === '') {
        return false
    }

    try {
        const result = await $fetch<{ success: boolean }>('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: {
                secret: config.turnstileSecretKey,
                response: token,
                remoteip: getRequestIP(event, { xForwardedFor: true }),
            },
        })
        return result?.success === true
    } catch (error) {
        // Fails closed (the visitor gets "Sicherheitsprüfung fehlgeschlagen" and
        // can retry) but is logged, so an outage at Cloudflare is visible.
        console.error('Turnstile verification failed:', error)
        return false
    }
}
