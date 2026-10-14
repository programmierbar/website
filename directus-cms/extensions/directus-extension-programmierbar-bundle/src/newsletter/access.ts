export interface AccessError {
    status: 401 | 403
    message: string
}

/**
 * Gate for the newsletter endpoints: every logged-in Data Studio user may use the
 * non-destructive actions (Live Preview, test send to their own address); what they may
 * see is limited by reading with their own permissions. Destructive or irreversible
 * actions must use a stricter check. Returns `null` when the request may proceed.
 */
export function checkAuthenticated(accountability: { user?: string | null } | null | undefined) {
    if (!accountability?.user) {
        return { status: 401, message: 'Anmeldung erforderlich' } satisfies AccessError
    }
    return null
}
