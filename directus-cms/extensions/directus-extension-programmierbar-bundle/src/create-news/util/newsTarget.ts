import { getUrlSlug } from './../../../../../../shared-code/index.ts'

/**
 * The Directus collection whose items are mirrored into the `news` meta
 * collection, and the m2a discriminator value stored on the junction.
 */
export const SOURCE_COLLECTION = 'news_links'

/** The meta collection every news source is surfaced through. */
export const NEWS_COLLECTION = 'news'

/** The many-to-any junction linking `news` to its source items. */
export const JUNCTION_COLLECTION = 'news_target'

/** Status a freshly mirrored / unpublished item carries. */
export const DRAFT_STATUS = 'draft'

/** Status a source item is set to when its `news` wrapper is deleted. */
export const ARCHIVED_STATUS = 'archived'

/** Minimal shape of the ItemsService methods used by the helpers below. */
interface ReadableService {
    readByQuery: (query: Record<string, any>) => Promise<any[]>
}

/**
 * Extract the affected keys from a Directus action metadata object. Single
 * creates expose `key` while (batch) creates/deletes/updates expose `keys`.
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
 * Read the junction rows that link a given `news` item to its `news_links`
 * sources. Used to find the source item(s) to mirror status onto (or archive).
 *
 * @param junctionService An ItemsService for `news_target`.
 * @param newsId The id of the `news` item.
 * @param fields The junction fields to read.
 */
export async function readJunctionRowsByNewsId(
    junctionService: ReadableService,
    newsId: string | number,
    fields: string[] = ['id', 'target']
): Promise<any[]> {
    return junctionService.readByQuery({
        filter: { news_id: { _eq: newsId }, collection: { _eq: SOURCE_COLLECTION } },
        fields,
        limit: -1,
    })
}

/**
 * Build a unique slug for a `news` item from its source link title. The `news`
 * collection has a unique constraint on `slug`, so a plain `getUrlSlug(title)`
 * would throw on a duplicate title; append `-2`, `-3`, … until free.
 *
 * Returns `null` when there is no usable title, leaving the slug unset (the
 * column is nullable, and Postgres allows multiple NULLs under a unique index).
 *
 * @param newsService An ItemsService for `news`.
 * @param title The source link title to derive the slug from.
 * @param excludeNewsId A `news` id to ignore when checking for collisions (used
 *   when re-slugging an existing item so it doesn't collide with itself).
 */
export async function buildUniqueNewsSlug(
    newsService: ReadableService,
    title: string | null | undefined,
    excludeNewsId?: string | number
): Promise<string | null> {
    if (!title) {
        return null
    }

    const base = getUrlSlug(title)
    if (!base) {
        return null
    }

    const existing = await newsService.readByQuery({
        filter: { slug: { _starts_with: base } },
        fields: ['id', 'slug'],
        limit: -1,
    })

    const taken = new Set(
        (existing ?? [])
            .filter((row: any) => excludeNewsId === undefined || String(row.id) !== String(excludeNewsId))
            .map((row: any) => row.slug)
    )

    if (!taken.has(base)) {
        return base
    }

    let suffix = 2
    while (taken.has(`${base}-${suffix}`)) {
        suffix++
    }
    return `${base}-${suffix}`
}
