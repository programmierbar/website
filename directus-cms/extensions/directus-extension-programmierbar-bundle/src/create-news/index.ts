import { defineHook } from '@directus/extensions-sdk'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { isPublishable } from '../shared/isPublishable.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import {
    ARCHIVED_STATUS,
    buildJunctionPayload,
    buildUniqueNewsSlug,
    DRAFT_STATUS,
    extractKeys,
    JUNCTION_COLLECTION,
    NEWS_COLLECTION,
    readJunctionRowsByNewsId,
    SOURCE_COLLECTION,
} from './util/newsTarget.ts'

const HOOK_NAME = 'create-news'

/**
 * `news` is a meta collection that surfaces every kind of news source through
 * the `news_target` many-to-any junction, so links (and future source types)
 * can be queried from a single place. This hook keeps the two collections in
 * sync in both directions:
 *
 *   Source-driven (hosts/guests author `news_links`):
 *     - on create, mirror the link into a new `news` item (always `draft`, so
 *       nothing is public until an editor publishes it) and set `news.slug` from
 *       the link title;
 *     - on title update, keep `news.slug` in sync;
 *     - on delete, remove the `news` item and junction row so no orphans remain.
 *
 *   Publication-driven (the editor works only on `news`):
 *     - `news.status` is the single editorial control; on change we mirror it
 *       down to `news_links.status`, which is the field the public read
 *       permission filters on (it is system-managed, never edited by hand);
 *     - before a `news` is published we validate its source link is complete;
 *     - on `news` delete we archive the source link (kept for podcast production)
 *       and drop the dangling junction row.
 *
 * The m2a junction has no foreign key on `news_target.target` and only nullifies
 * `news_id` when a `news` item is deleted, so neither side cascades at the DB
 * level — every path is handled explicitly here.
 */
export default defineHook(({ action, filter }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const FieldsService = hookContext.services.FieldsService
    const getSchema = hookContext.getSchema

    // `news_links.status` is system-managed: contributors never publish directly,
    // so force new links to `draft` regardless of the submitted payload. Only an
    // editor publishing the wrapping `news` item flips it (mirrored below).
    filter(`${SOURCE_COLLECTION}.items.create`, (payload: any) => ({
        ...(payload ?? {}),
        status: DRAFT_STATUS,
    }))

    action(
        `${SOURCE_COLLECTION}.items.create`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleLinkCreate(metadata, eventContext))
    )

    action(
        `${SOURCE_COLLECTION}.items.update`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleLinkUpdate(metadata, eventContext))
    )

    action(
        `${SOURCE_COLLECTION}.items.delete`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleLinkDelete(metadata, eventContext))
    )

    // Block publishing a `news` whose source link is missing required fields.
    // A filter (not an action) so the throw actually prevents the update.
    filter(`${NEWS_COLLECTION}.items.update`, (payload: any, metadata: any, context: any) =>
        guardNewsPublish(payload, metadata, context)
    )

    action(
        `${NEWS_COLLECTION}.items.update`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleNewsStatusChange(metadata, eventContext))
    )

    // Archive the source link before the `news` row is deleted — a filter,
    // because after deletion the junction's `news_id` is already nulled and the
    // link can no longer be reached.
    filter(`${NEWS_COLLECTION}.items.delete`, (keys: any, metadata: any, context: any) =>
        handleNewsDelete(keys, context)
    )

    /**
     * Mirror a newly created `news_links` item into a `news` meta item and wire
     * up the junction. The `news` item is always created as `draft`.
     */
    async function handleLinkCreate(metadata: Record<string, any>, eventContext: Record<string, any>) {
        const keys = extractKeys(metadata)
        if (keys.length === 0) {
            logger.warn(`${HOOK_NAME}: No key found for ${SOURCE_COLLECTION} create action`)
            return
        }

        const schema = await getSchema()
        const newsService = new ItemsService(NEWS_COLLECTION, { schema, accountability: eventContext.accountability })
        const junctionService = new ItemsService(JUNCTION_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })
        const sourceService = new ItemsService(SOURCE_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })

        // Batched creates fire a single action carrying keys[]; create the meta
        // item per key so every link gets its own news entry (see ADR 0002).
        for (const newsLinkId of keys) {
            try {
                // Idempotency guard: never create a second news item for a link
                // that is already referenced (e.g. on a replayed/re-fired event).
                const existing = await junctionService.readByQuery({
                    filter: { collection: { _eq: SOURCE_COLLECTION }, target: { _eq: String(newsLinkId) } },
                    fields: ['id'],
                    limit: 1,
                })
                if (existing.length > 0) {
                    logger.info(`${HOOK_NAME}: ${SOURCE_COLLECTION} ${newsLinkId} is already linked to a news item, skipping`)
                    continue
                }

                // Derive the slug from the link title. Prefer the payload; only
                // read the persisted item when the payload omitted it.
                let title = metadata.payload?.title
                if (title === undefined) {
                    const sourceItem = await sourceService.readOne(newsLinkId, { fields: ['title'] })
                    title = sourceItem?.title
                }
                const slug = await buildUniqueNewsSlug(newsService, title)

                const newsId = (await newsService.createOne({
                    status: DRAFT_STATUS,
                    ...(slug ? { slug } : {}),
                })) as string

                // Roll back the just-created news row if wiring up the junction
                // fails — otherwise it is left orphaned and, since the idempotency
                // guard only checks news_target, a retry would create yet another
                // orphan for the same link.
                try {
                    await junctionService.createOne(buildJunctionPayload(newsId, newsLinkId))
                } catch (junctionError: any) {
                    try {
                        await newsService.deleteOne(newsId)
                    } catch (cleanupError: any) {
                        logger.error(
                            `${HOOK_NAME}: Failed to roll back orphaned news ${newsId} for ${SOURCE_COLLECTION} ${newsLinkId}: ${cleanupError.message}`
                        )
                    }
                    throw junctionError
                }

                logger.info(`${HOOK_NAME}: Created news ${newsId} for ${SOURCE_COLLECTION} ${newsLinkId} (slug: ${slug ?? 'none'})`)
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Failed to create news item for ${SOURCE_COLLECTION} ${newsLinkId}: ${error.message}`)
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Für den News-Link ${newsLinkId} konnte kein verknüpfter News-Eintrag erstellt werden. Der Link ist dadurch nicht über die News-Sammlung abrufbar. Bitte manuell prüfen:\n` +
                        `Fehler: ${error.message}\n` +
                        `${env.PUBLIC_URL}admin/content/${SOURCE_COLLECTION}/${newsLinkId}`
                )
            }
        }
    }

    /**
     * Keep `news.slug` in sync when a link's title changes. The slug lives on
     * `news` (it is the addressable URL), so it is updated on the parent here.
     */
    async function handleLinkUpdate(metadata: Record<string, any>, eventContext: Record<string, any>) {
        // Only the title feeds the slug; ignore every other link update.
        if (metadata.payload?.title === undefined) {
            return
        }

        const keys = extractKeys(metadata)
        if (keys.length === 0) {
            return
        }

        const schema = await getSchema()
        const newsService = new ItemsService(NEWS_COLLECTION, { schema, accountability: eventContext.accountability })
        const junctionService = new ItemsService(JUNCTION_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })

        for (const newsLinkId of keys) {
            try {
                const rows = await junctionService.readByQuery({
                    filter: { collection: { _eq: SOURCE_COLLECTION }, target: { _eq: String(newsLinkId) } },
                    fields: ['news_id'],
                    limit: 1,
                })
                const newsId = rows[0]?.news_id
                if (!newsId) {
                    // No wrapper yet (e.g. create is still in flight); the create
                    // path sets the slug from the same title, so nothing to do.
                    continue
                }

                const slug = await buildUniqueNewsSlug(newsService, metadata.payload.title, newsId)
                if (!slug) {
                    // Title cleared to empty; keep the existing slug rather than
                    // nulling a URL that may already be linked to.
                    continue
                }

                await newsService.updateOne(newsId, { slug })
                logger.info(`${HOOK_NAME}: Updated slug of news ${newsId} to "${slug}" from ${SOURCE_COLLECTION} ${newsLinkId}`)
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Failed to sync slug for ${SOURCE_COLLECTION} ${newsLinkId}: ${error.message}`)
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Der Slug des News-Eintrags für den Link ${newsLinkId} konnte nicht aktualisiert werden.\n` +
                        `Fehler: ${error.message}`
                )
            }
        }
    }

    /**
     * Remove the `news` item and junction row when its source link is deleted.
     */
    async function handleLinkDelete(metadata: Record<string, any>, eventContext: Record<string, any>) {
        const keys = extractKeys(metadata)
        if (keys.length === 0) {
            logger.warn(`${HOOK_NAME}: No keys found for ${SOURCE_COLLECTION} delete action`)
            return
        }

        const schema = await getSchema()
        const newsService = new ItemsService(NEWS_COLLECTION, { schema, accountability: eventContext.accountability })
        const junctionService = new ItemsService(JUNCTION_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })

        for (const newsLinkId of keys) {
            try {
                const junctionRows = await junctionService.readByQuery({
                    filter: { collection: { _eq: SOURCE_COLLECTION }, target: { _eq: String(newsLinkId) } },
                    fields: ['id', 'news_id'],
                })

                if (junctionRows.length === 0) {
                    continue
                }

                // Delete the junction rows first, then the news items. There is no
                // DB cascade (target has no FK; news_id only SET NULLs), so both
                // must be removed explicitly to avoid orphaned meta items.
                for (const row of junctionRows) {
                    await junctionService.deleteOne(row.id)
                }

                const newsIds = junctionRows.map((row: Record<string, any>) => row.news_id).filter(Boolean)
                for (const newsId of newsIds) {
                    await newsService.deleteOne(newsId)
                }

                logger.info(
                    `${HOOK_NAME}: Removed ${junctionRows.length} junction row(s) and ${newsIds.length} news item(s) for deleted ${SOURCE_COLLECTION} ${newsLinkId}`
                )
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Failed to clean up news item for deleted ${SOURCE_COLLECTION} ${newsLinkId}: ${error.message}`)
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Nach dem Löschen des News-Links ${newsLinkId} konnte der verknüpfte News-Eintrag nicht aufgeräumt werden. Es könnte ein verwaister Eintrag zurückbleiben.\n` +
                        `Fehler: ${error.message}`
                )
            }
        }
    }

    /**
     * Runs when a `news` item is published. Two jobs:
     *   1. Guard — block the publish if the source link is incomplete (same
     *      `isPublishable` check the scheduled-publication flow uses). Infra
     *      failures fail open (log + notify) so a transient glitch can't block
     *      every publish; only a genuinely incomplete link throws.
     *   2. Self-heal — if the item is being published without a slug (e.g. a
     *      pre-migration item, or one whose title never produced one), derive it
     *      from the link title and inject it into the same update, so it is
     *      reachable at `/news/<slug>` without a manual backfill.
     */
    async function guardNewsPublish(payload: any, metadata: any, context: any) {
        if (payload?.status !== 'published') {
            return payload
        }

        const keys = Array.isArray(metadata?.keys) ? metadata.keys : metadata?.key ? [metadata.key] : []
        if (keys.length === 0) {
            return payload
        }

        const newsService = new ItemsService(NEWS_COLLECTION, {
            schema: context.schema,
            accountability: context.accountability,
        })
        const junctionService = new ItemsService(JUNCTION_COLLECTION, {
            schema: context.schema,
            accountability: context.accountability,
        })
        const sourceService = new ItemsService(SOURCE_COLLECTION, {
            schema: context.schema,
            accountability: context.accountability,
        })

        const pairs: Array<{ newsId: string | number; link: Record<string, any> }> = []
        let fields: any[]
        try {
            const fieldsService = new FieldsService({ schema: context.schema })
            fields = await fieldsService.readAll(SOURCE_COLLECTION)

            for (const newsId of keys) {
                const rows = await readJunctionRowsByNewsId(junctionService, newsId, ['target'])
                const linkIds = rows.map((row: any) => row.target).filter(Boolean)
                if (linkIds.length === 0) {
                    continue
                }
                const links = await sourceService.readByQuery({ filter: { id: { _in: linkIds } } })
                for (const link of links) {
                    pairs.push({ newsId, link })
                }
            }
        } catch (error: any) {
            logger.error(`${HOOK_NAME}: Publish guard could not verify source links, allowing publish: ${error.message}`)
            await notifySlack(
                `:warning: *${HOOK_NAME}*: Die Pflichtfeld-Prüfung vor dem Veröffentlichen von News konnte nicht ausgeführt werden. Die Veröffentlichung wurde trotzdem zugelassen.\n` +
                    `Fehler: ${error.message}`
            )
            return payload
        }

        for (const { newsId, link } of pairs) {
            if (!isPublishable(link, fields)) {
                const hookError = createHookErrorConstructor(
                    HOOK_NAME,
                    `News ${newsId} kann nicht veröffentlicht werden: Der verknüpfte News-Link ${link.id} hat nicht alle Pflichtfelder ausgefüllt.`
                )
                throw new hookError()
            }
        }

        // Self-heal a missing slug. A filter shares one payload across all keys,
        // so a slug can only be injected for a single-key update; batch publishes
        // fall back to the create/title-update paths (or a manual backfill).
        if (keys.length === 1 && !payload.slug) {
            try {
                const newsId = keys[0]
                const current = await newsService.readOne(newsId, { fields: ['slug'] })
                if (!current?.slug) {
                    const link = pairs.find((pair) => String(pair.newsId) === String(newsId))?.link
                    const slug = await buildUniqueNewsSlug(newsService, link?.title, newsId)
                    if (slug) {
                        logger.info(`${HOOK_NAME}: Backfilled slug "${slug}" on news ${newsId} at publish time`)
                        return { ...payload, slug }
                    }
                }
            } catch (error: any) {
                // A failed backfill must never block the publish itself.
                logger.warn(`${HOOK_NAME}: Could not backfill slug on publish: ${error.message}`)
            }
        }

        return payload
    }

    /**
     * Mirror a `news` status change down to its source link(s). `news.status` is
     * the editorial source of truth; `news_links.status` is a read gate kept in
     * lock-step so the public API only exposes published links.
     */
    async function handleNewsStatusChange(metadata: Record<string, any>, eventContext: Record<string, any>) {
        const newStatus = metadata.payload?.status
        if (newStatus === undefined) {
            return
        }

        const keys = extractKeys(metadata)
        if (keys.length === 0) {
            return
        }

        const schema = await getSchema()
        const junctionService = new ItemsService(JUNCTION_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })
        const sourceService = new ItemsService(SOURCE_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })

        for (const newsId of keys) {
            try {
                const rows = await readJunctionRowsByNewsId(junctionService, newsId, ['target'])
                const linkIds = rows.map((row: any) => row.target).filter(Boolean)

                // Update one at a time so each fires its own news_links action for
                // downstream hooks (Algolia, etc.). See ADR 0002.
                for (const linkId of linkIds) {
                    await sourceService.updateOne(linkId, { status: newStatus })
                }

                if (linkIds.length > 0) {
                    logger.info(`${HOOK_NAME}: Mirrored status "${newStatus}" from news ${newsId} to ${linkIds.length} link(s)`)
                }
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Failed to mirror status for news ${newsId}: ${error.message}`)
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Der Status von News ${newsId} konnte nicht auf den verknüpften News-Link übertragen werden. Sichtbarkeit und Status können auseinanderlaufen.\n` +
                        `Fehler: ${error.message}\n` +
                        `${env.PUBLIC_URL}admin/content/${NEWS_COLLECTION}/${newsId}`
                )
            }
        }
    }

    /**
     * Archive the source link(s) of a `news` item that is being deleted and drop
     * the junction row. The link is kept (it has editorial value for podcast
     * production) but hidden from the audience.
     */
    async function handleNewsDelete(keys: any, context: any) {
        const ids = Array.isArray(keys) ? keys : []
        if (ids.length === 0) {
            return keys
        }

        const junctionService = new ItemsService(JUNCTION_COLLECTION, {
            schema: context.schema,
            accountability: context.accountability,
        })
        const sourceService = new ItemsService(SOURCE_COLLECTION, {
            schema: context.schema,
            accountability: context.accountability,
        })

        // Catch per news id so that, in a batch delete, one failing item does not
        // abort the rest — otherwise the remaining links would stay published and
        // publicly readable. Never block the deletion itself; a leftover archived
        // link / junction row is recoverable, a blocked delete is worse.
        for (const newsId of ids) {
            try {
                const rows = await readJunctionRowsByNewsId(junctionService, newsId, ['id', 'target'])
                for (const row of rows) {
                    if (row.target) {
                        await sourceService.updateOne(row.target, { status: ARCHIVED_STATUS })
                    }
                    await junctionService.deleteOne(row.id)
                }
                if (rows.length > 0) {
                    logger.info(`${HOOK_NAME}: Archived ${rows.length} link(s) and dropped junction row(s) for deleted news ${newsId}`)
                }
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Failed to archive source links for deleted news ${newsId}: ${error.message}`)
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Beim Löschen des News-Eintrags ${newsId} konnte der verknüpfte News-Link nicht archiviert werden. Bitte manuell prüfen.\n` +
                        `Fehler: ${error.message}`
                )
            }
        }

        return keys
    }

    async function notifySlack(message: string) {
        try {
            await postSlackMessage(message)
        } catch (slackError: any) {
            logger.error(`${HOOK_NAME}: Failed to send Slack notification: ${slackError.message}`)
        }
    }

    logger.info(`${HOOK_NAME} hook registered`)
})
