import type { HiddenEntry, RenderReport } from './types.ts'

/**
 * The website shows a podcast or meetup only while its `status` is `published`: its
 * Nuxt queries (`nuxt-app/composables/useDirectus.ts`) do not filter, the public Directus
 * permissions do, and draft/archived items answer 404 on the website. Scheduled items stay
 * `draft` until `schedule-publication` flips them, so `published_on` needs no extra check.
 *
 * The renderer applies the same rule, so a mail never links to a page that does not exist
 * and the Live Preview shows exactly what the send job will send.
 */
export const PUBLISHED_STATUS = 'published'

export function isPublished(item: { status?: string | null }): boolean {
    return item.status === PUBLISHED_STATUS
}

/**
 * Keep the published items (in their incoming order) and record every other one in
 * `report.hidden`, so callers can tell the editor what was left out and why.
 */
export function selectPublished<T extends { status?: string | null }>(
    items: readonly T[],
    collection: HiddenEntry['collection'],
    describe: (item: T) => string,
    report: RenderReport
): T[] {
    return items.filter((item) => {
        if (isPublished(item)) {
            return true
        }
        report.hidden.push({ collection, title: describe(item), status: item.status ?? null, reason: 'unpublished' })
        return false
    })
}
