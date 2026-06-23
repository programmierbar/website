import type { H3Event } from 'h3'

/**
 * Verifies that the incoming request has a valid Directus user session.
 * Reads the session cookie from the request and validates it against Directus.
 * Throws a 401 error if the user is not authenticated.
 */
export async function requireDirectusUser(event: H3Event) {
    const config = useRuntimeConfig()
    const cookie = getHeader(event, 'cookie')

    if (!cookie) {
        throw createError({ statusCode: 401, message: 'Not authenticated' })
    }

    // Attempt to refresh the session first, so short-lived access tokens
    // don't cause 401s while a valid refresh token still exists.
    await fetch(`${config.public.directusCmsUrl}/auth/refresh`, {
        method: 'POST',
        headers: { cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'cookie' }),
    }).catch(() => {})

    const response = await fetch(`${config.public.directusCmsUrl}/users/me`, {
        headers: { cookie },
    })

    if (!response.ok) {
        throw createError({ statusCode: 401, message: 'Not authenticated' })
    }

    return await response.json()
}
