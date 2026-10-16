import { createHash, timingSafeEqual } from 'node:crypto'

export type AuthResult = { ok: true } | { ok: false; status: 401 | 503; reason: string }

/**
 * Brevo has no payload signature. Its webhook can authenticate with HTTP Basic auth
 * (credentials in the notify URL, `https://user:secret@host/path`) or a bearer token.
 * Only Basic auth works here: Directus reads every `Authorization: Bearer …` header as a
 * Directus access token and rejects an unknown one with 401 before an endpoint runs.
 *
 * The password must equal `BREVO_WEBHOOK_SECRET`; the user name is not checked. Fails
 * closed: without a configured secret every request is refused with 503.
 */
export function checkBasicAuth(authorization: unknown, secret: unknown): AuthResult {
    const expected = typeof secret === 'string' || typeof secret === 'number' ? String(secret).trim() : ''
    if (!expected) {
        return { ok: false, status: 503, reason: 'BREVO_WEBHOOK_SECRET is not configured' }
    }

    if (typeof authorization !== 'string') {
        return { ok: false, status: 401, reason: 'missing Authorization header' }
    }
    const match = /^Basic\s+(\S+)\s*$/i.exec(authorization)
    if (!match) {
        return { ok: false, status: 401, reason: 'Authorization is not Basic' }
    }
    const decoded = Buffer.from(match[1]!, 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    const password = separator >= 0 ? decoded.slice(separator + 1) : ''

    if (!safeEqual(password, expected)) {
        return { ok: false, status: 401, reason: 'wrong credentials' }
    }
    return { ok: true }
}

/** Constant-time comparison; hashing first makes both sides the same length. */
function safeEqual(a: string, b: string): boolean {
    const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()
    return timingSafeEqual(digest(a), digest(b))
}
