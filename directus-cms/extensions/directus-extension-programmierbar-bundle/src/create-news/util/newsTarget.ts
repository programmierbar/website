/**
 * The Directus collection whose items are mirrored into the `news` meta
 * collection, and the m2a discriminator value stored on the junction.
 */
export const SOURCE_COLLECTION = 'news_links'

/** Status used when a `news_links` item is created without an explicit status. */
export const DEFAULT_STATUS = 'draft'

/**
 * Extract the affected keys from a Directus action metadata object. Single
 * creates expose `key` while (batch) creates/deletes expose `keys` (an array).
 *
 * @param metadata The action metadata.
 */
export function extractKeys(metadata: Record<string, any> | undefined): Array<string | number> {
    if (!metadata) {
        return []
    }

    if (Array.isArray(metadata.keys)) {
        return metadata.keys
    }

    return metadata.key !== undefined && metadata.key !== null ? [metadata.key] : []
}

/**
 * Build the payload for a `news_target` junction row linking a `news` item to
 * its source `news_links` item. `target` stores the source item's primary key
 * and `collection` is the m2a discriminator.
 *
 * @param newsId The id of the freshly created `news` item.
 * @param newsLinkId The id of the source `news_links` item.
 */
export function buildJunctionPayload(newsId: string, newsLinkId: string | number) {
    return {
        news_id: newsId,
        collection: SOURCE_COLLECTION,
        target: String(newsLinkId),
    }
}

/**
 * Resolve the status to mirror onto the `news` item. Prefer the status from the
 * create payload, fall back to the persisted source item, then to a draft.
 *
 * @param payload The create action payload (may omit status).
 * @param sourceItem The persisted `news_links` item, if it had to be read.
 */
export function resolveStatus(
    payload: Record<string, any> | undefined,
    sourceItem?: Record<string, any> | null
): string {
    return payload?.status ?? sourceItem?.status ?? DEFAULT_STATUS
}
