/**
 * Directus answers a missing item, an invalid primary key and an unknown Content Version all with a
 * ForbiddenError (so as not to reveal what exists). For an admin, or wherever the caller is known to
 * be allowed to read the collection, it can only mean "not found". Any other error is a real failure
 * and should be rethrown, not reported as a missing item.
 */
export function isNotFoundError(err: any): boolean {
    return err?.code === 'FORBIDDEN' || err?.name === 'ForbiddenError'
}
