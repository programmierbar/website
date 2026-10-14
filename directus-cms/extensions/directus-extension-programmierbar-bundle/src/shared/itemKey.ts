/**
 * Whether an interface sits on an existing item's detail page.
 *
 * Directus mounts interfaces with primary key `'+'` on the create page AND
 * while an existing item's record is still being loaded (the real key is only
 * passed in afterwards), so callers must re-evaluate when the key changes.
 */
export function isExistingItemKey(primaryKey: string | number | null | undefined): boolean {
    return Boolean(primaryKey && primaryKey !== '+')
}
