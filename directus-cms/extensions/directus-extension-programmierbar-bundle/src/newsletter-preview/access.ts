export interface AccessError {
    status: 401 | 403
    message: string
}

/**
 * Admin-only gate for the preview. Unauthenticated requests get 401, authenticated
 * non-admins 403. Returns `null` when the request may proceed.
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
