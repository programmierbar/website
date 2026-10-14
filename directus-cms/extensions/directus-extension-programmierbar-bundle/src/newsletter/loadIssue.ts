import { MEETUPS_BLOCK_COLLECTION, PODCASTS_BLOCK_COLLECTION, TEXT_BLOCK_COLLECTION } from './render/types.ts'
import type { NewsletterIssue } from './render/types.ts'

export const ISSUES_COLLECTION = 'newsletter_issues'

/**
 * Fields needed to render an issue. `blocks` is the M2A alias over the junction
 * `newsletter_issues_blocks` (`sort`, `collection`, `item`); the podcast/meetup blocks
 * are M2M over `newsletter_blocks_podcasts_podcasts` / `newsletter_blocks_meetups_meetups`,
 * each with its own `sort`.
 */
export const ISSUE_FIELDS = [
    'id',
    'subject',
    'preheader',
    'blocks.id',
    'blocks.sort',
    'blocks.collection',
    `blocks.item:${TEXT_BLOCK_COLLECTION}.heading`,
    `blocks.item:${TEXT_BLOCK_COLLECTION}.body`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.heading`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.sort`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.slug`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.type`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.number`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.title`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.heading`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.sort`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.slug`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.title`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.start_on`,
]

/**
 * Directus caps nested O2M/M2M reads at the default query limit; lift it so a long
 * block list is never silently truncated. The renderer sorts by `sort` itself, so the
 * read order does not matter.
 */
export const ISSUE_DEEP = {
    blocks: { _limit: -1 },
}

/** The slice of a Directus `ItemsService` this module needs. */
export interface IssueReader {
    readOne(key: string, query: Record<string, unknown>): Promise<NewsletterIssue>
}

/**
 * Whether `version` names a Content Version. The Live Preview passes `{{$version}}`,
 * which is `main` for the live item; an empty value means the same.
 */
export function isContentVersion(version: unknown): version is string {
    return typeof version === 'string' && version.trim() !== '' && version !== 'main'
}

/**
 * Load one issue with everything the renderer needs. With a Content Version key,
 * Directus applies that version's saved delta (including nested block changes) and
 * returns the merged item; it does so inside a rolled-back transaction, so nothing is
 * written. Throws the service's error (Directus answers "not found" with a
 * ForbiddenError) when the issue or the version does not exist.
 */
export async function loadNewsletterIssue(
    service: IssueReader,
    id: string,
    version?: string | null
): Promise<NewsletterIssue> {
    const query: Record<string, unknown> = { fields: ISSUE_FIELDS, deep: ISSUE_DEEP }
    if (isContentVersion(version)) {
        query.version = version
    }
    return service.readOne(id, query)
}
