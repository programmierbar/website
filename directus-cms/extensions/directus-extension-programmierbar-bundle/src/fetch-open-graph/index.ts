import { defineHook } from '@directus/extensions-sdk'
import { default as axios } from 'axios'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import { buildOpenGraph } from './util/openGraph.ts'
import { assertPublicUrl } from './util/urlSafety.ts'

const HOOK_NAME = 'fetch-open-graph'
const COLLECTION = 'news_links'

// Cap the downloaded HTML so a huge (or malicious) response cannot exhaust
// memory. Open Graph tags live in <head>, so a few MB is more than enough.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024

// A real browser User-Agent — many sites return 403/empty bodies to the default
// axios agent, which would leave us with no Open Graph data to extract.
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/**
 * Fetches the Open Graph metadata of a `news_links` item's URL and caches it in
 * the item's `open_graph` JSON field. Runs when a link is created or when its
 * `link` changes.
 *
 * Loop avoidance follows the `screenshot` hook: the trigger field (`link`) is
 * only present in the payload on create / link change, and the write-back sets
 * only `open_graph` — so the re-fired update fails the `payload.link` guard and
 * does not re-trigger the fetch.
 */
export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService

    action(
        `${COLLECTION}.items.create`,
        safeAction(HOOK_NAME, logger, ({ payload, ...metadata }, context) => handleAction(payload, metadata, context))
    )

    action(
        `${COLLECTION}.items.update`,
        safeAction(HOOK_NAME, logger, ({ payload, ...metadata }, context) => handleAction(payload, metadata, context))
    )

    async function handleAction(payload: any, metadata: Record<string, any>, context: any) {
        // Guard: only act when the URL was set/changed. This also prevents the
        // open_graph write-back below from re-triggering the hook.
        if (!payload?.link) {
            return
        }

        const url: string = payload.link
        const keys: Array<string | number> = metadata.keys ?? (metadata.key !== undefined ? [metadata.key] : [])

        if (keys.length === 0) {
            logger.warn(`${HOOK_NAME}: No key found for ${COLLECTION} action`)
            return
        }

        // Default to an empty object. When the fetch is skipped or fails we still
        // write this back, both to signal that processing ran without a usable
        // result and to clear any stale Open Graph data cached for a previous link.
        let openGraph: Record<string, any> = {}
        try {
            // SSRF guard: only fetch public http(s) URLs, never internal hosts.
            await assertPublicUrl(url)

            logger.info(`${HOOK_NAME}: Fetching Open Graph data for ${url}`)
            const response = await axios.get(url, {
                timeout: 10_000,
                maxRedirects: 5,
                maxContentLength: MAX_RESPONSE_BYTES,
                maxBodyLength: MAX_RESPONSE_BYTES,
                responseType: 'text',
                // Never throw on 4xx/5xx — handle status explicitly below.
                validateStatus: () => true,
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml',
                },
            })

            if (response.status >= 400) {
                throw new Error(`Request to ${url} returned status ${response.status}`)
            }

            const contentType = String(response.headers?.['content-type'] ?? '')
            if (contentType && !contentType.includes('html')) {
                // Not an error — just nothing to parse. openGraph stays {}.
                logger.info(`${HOOK_NAME}: Skipping non-HTML response (${contentType}) for ${url}`)
            } else {
                // Resolve relative URLs (notably og:image) against the FINAL URL
                // after any redirects, not the originally requested one.
                const finalUrl = response.request?.res?.responseUrl || response.request?.responseURL || url
                openGraph = buildOpenGraph(String(response.data), finalUrl)
            }
        } catch (error: any) {
            logger.error(`${HOOK_NAME}: Failed to fetch Open Graph data for ${url}: ${error.message}`)
            await notifySlack(
                `:warning: *${HOOK_NAME}*: Die Open-Graph-Daten für den News-Link konnten nicht automatisch abgerufen werden (${url}). Bitte ggf. manuell ergänzen:\n` +
                    `Fehler: ${error.message}\n` +
                    `${env.PUBLIC_URL}admin/content/${COLLECTION}/${keys[0]}`
            )
            // openGraph stays {} and is still written below.
        }

        // The payload's `link` is shared across a batched update, so we fetch
        // once and write the result to each affected item individually
        // (per-item updateOne, see _ADRs/0002-batch-updates-use-updateone.md).
        const itemsService = new ItemsService(COLLECTION, {
            accountability: context.accountability,
            schema: context.schema,
        })

        for (const key of keys) {
            await itemsService.updateOne(key, { open_graph: openGraph })
            logger.info(`${HOOK_NAME}: Stored Open Graph data on ${COLLECTION} ${key}`)
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
