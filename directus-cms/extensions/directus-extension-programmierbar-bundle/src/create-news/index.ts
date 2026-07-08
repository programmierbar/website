import { defineHook } from '@directus/extensions-sdk'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import { buildJunctionPayload, extractKeys, resolveStatus, SOURCE_COLLECTION } from './util/newsTarget.ts'

const HOOK_NAME = 'create-news'
const NEWS_COLLECTION = 'news'
const JUNCTION_COLLECTION = 'news_target'

/**
 * `news` is a meta collection that references every kind of news source through
 * the `news_target` many-to-any junction, so links (and future source types)
 * can be queried from a single place. This hook keeps that meta collection in
 * sync for `news_links`:
 *   - on create, it mirrors the link into a new `news` item and wires up the
 *     junction row (status is copied once, at creation time);
 *   - on delete, it removes the linked `news` item and junction row so no
 *     orphans remain.
 *
 * The m2a junction has no foreign key on `news_target.target` and only nullifies
 * `news_id` when a `news` item is deleted, so neither side cascades at the DB
 * level — both paths are handled explicitly here.
 */
export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    action(
        `${SOURCE_COLLECTION}.items.create`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleCreate(metadata, eventContext))
    )

    action(
        `${SOURCE_COLLECTION}.items.delete`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleDelete(metadata, eventContext))
    )

    async function handleCreate(metadata: Record<string, any>, eventContext: Record<string, any>) {
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

                // Prefer the payload status; only read the persisted item when the
                // payload omitted it (e.g. status defaulted on the DB side).
                let status = resolveStatus(metadata.payload, null)
                if (metadata.payload?.status === undefined) {
                    const sourceItem = await sourceService.readOne(newsLinkId, { fields: ['status'] })
                    status = resolveStatus(metadata.payload, sourceItem)
                }

                const newsId = (await newsService.createOne({ status })) as string

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

                logger.info(`${HOOK_NAME}: Created news ${newsId} for ${SOURCE_COLLECTION} ${newsLinkId} (status: ${status})`)
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

    async function handleDelete(metadata: Record<string, any>, eventContext: Record<string, any>) {
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

    async function notifySlack(message: string) {
        try {
            await postSlackMessage(message)
        } catch (slackError: any) {
            logger.error(`${HOOK_NAME}: Failed to send Slack notification: ${slackError.message}`)
        }
    }

    logger.info(`${HOOK_NAME} hook registered`)
})
