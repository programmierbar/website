export interface AccessError {
    status: 401 | 403
    message: string
}

/**
 * Admin-only gate (e.g. the Live Preview). Unauthenticated
 * requests get 401, authenticated non-admins 403. Returns `null` when the request may
 * proceed.
 */
export function checkAdminAccess(accountability: { user?: string | null; admin?: boolean } | null | undefined) {
    if (accountability?.admin === true) {
        return null
    }
    if (!accountability?.user) {
        return { status: 401, message: 'Anmeldung erforderlich' } satisfies AccessError
    }
    return { status: 403, message: 'Nur für Admins' } satisfies AccessError
}

/**
 * Gate for actions any logged-in Data Studio user may run (e.g. the test send, which
 * only ever mails the user themselves). Returns `null` when the request may proceed.
 */
export function checkAuthenticated(accountability: { user?: string | null } | null | undefined) {
    if (!accountability?.user) {
        return { status: 401, message: 'Anmeldung erforderlich' } satisfies AccessError
    }
    return null
}
