import { defineHook } from '@directus/extensions-sdk'
import {
    extractKeys,
    JUNCTION_COLLECTION,
    NEWS_COLLECTION,
    readJunctionRowsByNewsId,
    SOURCE_COLLECTION,
} from '../create-news/util/newsTarget.ts'
import { getRequiredSetting } from '../shared/settings.js'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import { buildNewsEmbed, postToDiscord } from './discord.ts'

const HOOK_NAME = 'post-to-discord'

/**
 * Posts a `news` item to Discord (via an incoming webhook) when it is published.
 *
 * The `news` collection is the editorial control: an editor publishes by setting
 * `news.status` to `published` (see the `create-news` hook, which owns the rest
 * of the news ↔ news_links lifecycle). The actual content — title, external
 * link, comment, Open Graph image — lives on the source `news_links` item, so we
 * resolve it through the `news_target` m2a junction before building the message.
 *
 * De-duplication: we post only when an update payload explicitly sets `status`
 * to `published`, i.e. on the publish transition. Directus update payloads carry
 * only changed fields, so a later re-save of an already-published item omits
 * `status` and does not re-post. (Unpublishing and re-publishing WILL post again
 * — an accepted trade-off of the field-less guard.)
 */
export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    const webhookUrl = env.DISCORD_WEBHOOK_URL

    if (!webhookUrl) {
        logger.warn(`${HOOK_NAME} hook: DISCORD_WEBHOOK_URL is not set. Discord posting will not be active.`)
        return
    }

    action(
        `${NEWS_COLLECTION}.items.update`,
        safeAction(HOOK_NAME, logger, (metadata, eventContext) => handleNewsPublish(metadata, eventContext))
    )

    async function handleNewsPublish(metadata: Record<string, any>, eventContext: Record<string, any>) {
        // Only react to the publish transition (see de-duplication note above).
        if (metadata.payload?.status !== 'published') {
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
        const sourceService = new ItemsService(SOURCE_COLLECTION, {
            schema,
            accountability: eventContext.accountability,
        })

        // Per-item try/catch so that, in a batch publish, one failure neither
        // aborts the rest nor blocks the publish itself — the item is already
        // published; a missed Discord post is recoverable via the Slack alert.
        for (const newsId of keys) {
            try {
                // Fail closed rather than defaulting to a production URL: a wrong
                // public Discord link is hard to retract, so if `website_url` is
                // not configured we skip the post and alert via Slack (below).
                const websiteUrl = await getRequiredSetting('website_url', hookContext)

                const news = await newsService.readOne(newsId, { fields: ['slug'] })

                const rows = await readJunctionRowsByNewsId(junctionService, newsId, ['target'])
                const linkIds = rows.map((row: any) => row.target).filter(Boolean)
                if (linkIds.length === 0) {
                    logger.warn(`${HOOK_NAME}: News ${newsId} has no source link, skipping Discord post`)
                    continue
                }

                const links = await sourceService.readByQuery({
                    filter: { id: { _in: linkIds } },
                    fields: ['id', 'title', 'link', 'comment', 'open_graph', 'member.first_name', 'member.last_name'],
                    limit: 1,
                })
                const link = links[0]
                if (!link) {
                    logger.warn(`${HOOK_NAME}: Source link for news ${newsId} not found, skipping Discord post`)
                    continue
                }

                const memberName = [link.member?.first_name, link.member?.last_name].filter(Boolean).join(' ')

                const payload = buildNewsEmbed({
                    title: link.title,
                    comment: link.comment,
                    link: link.link,
                    slug: news?.slug,
                    websiteUrl,
                    openGraph: link.open_graph,
                    memberName,
                })

                await postToDiscord(webhookUrl, payload, { logger })
                logger.info(`${HOOK_NAME}: Posted news ${newsId} to Discord`)
            } catch (error: any) {
                logger.error(`${HOOK_NAME}: Failed to post news ${newsId} to Discord: ${error.message}`)
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Der veröffentlichte News-Eintrag ${newsId} konnte nicht auf Discord gepostet werden. Bitte manuell prüfen.\n` +
                        `Fehler: ${error.message}\n` +
                        `${env.PUBLIC_URL}admin/content/${NEWS_COLLECTION}/${newsId}`
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
