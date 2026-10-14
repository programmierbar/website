import { MEETUPS_BLOCK_COLLECTION, PODCASTS_BLOCK_COLLECTION, TEXT_BLOCK_COLLECTION } from './render/types.ts'
import type { NewsletterIssue } from './render/types.ts'

export const ISSUES_COLLECTION = 'newsletter_issues'

/**
 * Fields needed to render an issue. `blocks` is the M2A alias over the junction
 * `newsletter_issues_blocks` (`sort`, `collection`, `item`); the podcast/meetup blocks
 * are M2M over `newsletter_blocks_podcasts_podcasts` / `newsletter_blocks_meetups_meetups`,
 * each with its own `sort`. The podcast/meetup `status` is needed for the renderer's
 * published filter.
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
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.status`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.slug`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.type`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.number`,
    `blocks.item:${PODCASTS_BLOCK_COLLECTION}.podcasts.podcasts_id.title`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.heading`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.sort`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.status`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.slug`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.title`,
    `blocks.item:${MEETUPS_BLOCK_COLLECTION}.meetups.meetups_id.start_on`,
]

/**
 * Directus caps every nested O2M/M2M read at the default query limit; lift it on each
 * level so neither the block list nor the podcasts/meetups of one block are silently
 * truncated. Inside the M2A, Directus addresses a collection's branch as
 * `item:<collection>` (see `parse-fields` in @directus/api). The renderer sorts by
 * `sort` itself, so the read order does not matter.
 */
export const ISSUE_DEEP = {
    blocks: {
        _limit: -1,
        [`item:${PODCASTS_BLOCK_COLLECTION}`]: { podcasts: { _limit: -1 } },
        [`item:${MEETUPS_BLOCK_COLLECTION}`]: { meetups: { _limit: -1 } },
    },
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

/**
 * Directus answers a missing item, an invalid primary key and an unknown Content
 * Version all with a ForbiddenError. The newsletter endpoints are admin-only, so there
 * it can only mean "not found".
 */
export function isNotFoundError(err: any): boolean {
    return err?.code === 'FORBIDDEN' || err?.name === 'ForbiddenError'
}

/** The issue cannot be shown to this user: it does not exist (404) or they may not read it (403). */
export class IssueAccessError extends Error {
    status: 403 | 404
    constructor(status: 403 | 404, message: string) {
        super(message)
        this.status = status
    }
}

/**
 * Load an issue with the requesting user's own permissions, so a user only previews or
 * test-sends what they may read. Directus answers both "missing" and "not allowed" with
 * a ForbiddenError; an admin existence check (with the same version) tells them apart,
 * so the caller can answer 404 or 403. It reveals existence only to logged-in users.
 */
export async function loadNewsletterIssueForUser(
    services: { ItemsService: any },
    schema: unknown,
    accountability: unknown,
    id: string,
    version?: string | null
): Promise<NewsletterIssue> {
    try {
        return await loadNewsletterIssue(
            new services.ItemsService(ISSUES_COLLECTION, { schema, accountability }),
            id,
            version
        )
    } catch (err: any) {
        if (!isNotFoundError(err)) {
            throw err
        }
    }

    const label = `Ausgabe ${id}${isContentVersion(version) ? ` (Version ${version})` : ''}`
    try {
        const adminQuery: Record<string, unknown> = { fields: ['id'] }
        if (isContentVersion(version)) {
            adminQuery.version = version
        }
        await new services.ItemsService(ISSUES_COLLECTION, { schema, accountability: { admin: true } }).readOne(
            id,
            adminQuery
        )
    } catch (err: any) {
        if (isNotFoundError(err)) {
            throw new IssueAccessError(404, `${label} nicht gefunden – ist sie schon gespeichert?`)
        }
        throw err
    }
    throw new IssueAccessError(403, `Keine Berechtigung, ${label} mit ihren Blöcken, Podcasts und Meetups zu lesen`)
}
