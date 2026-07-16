import { NEWS_FEED_PATH, NEWS_FEED_TITLE, WEBSITE_NAME, WEBSITE_URL } from '~/config'
import type { DirectusNewsLinkItem } from '~/types/directus'
// Imported explicitly because composables/ is auto-imported into the Vue app,
// not the Nitro server; nuxt.config.ts imports it the same way for build-time
// data fetching.
import { useDirectus } from '~/composables/useDirectus'
import RSS from 'rss'

// Resolve the `news_links` source that backs a news item. `news` is a meta
// collection referencing its content through the m2a `target`; today the only
// source type is `news_links`, and each news item wraps exactly one link.
function resolveNewsLink(
    target: {
        collection: string
        target: DirectusNewsLinkItem | string
    }[]
): DirectusNewsLinkItem | null {
    const entry = target?.find(
        (row) => row.collection === 'news_links' && typeof row.target === 'object' && row.target !== null
    )
    return (entry?.target as DirectusNewsLinkItem) ?? null
}

const IMAGE_MIME_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    avif: 'image/avif',
}

// An RSS enclosure requires a valid MIME type. The rss library guesses it from
// the URL's file extension and emits `type="false"` when it cannot (e.g. CDN
// image endpoints without an extension like opengraph.githubassets.com), which
// is invalid. We derive the type ourselves and drop the enclosure when unknown,
// keeping the feed valid rather than emitting a bogus type.
function imageEnclosure(imageUrl: string): { url: string; type: string } | null {
    let pathname: string
    try {
        pathname = new URL(imageUrl).pathname
    } catch {
        return null
    }
    const extension = pathname.split('.').pop()?.toLowerCase() ?? ''
    const type = IMAGE_MIME_TYPES[extension]
    return type ? { url: imageUrl, type } : null
}

export default defineEventHandler(async (event) => {
    const { getPublishedNews } = useDirectus()
    const news = await getPublishedNews()

    const feed = new RSS({
        title: NEWS_FEED_TITLE,
        description: `Kuratierte News rund um App- und Webentwicklung von ${WEBSITE_NAME}.`,
        site_url: WEBSITE_URL,
        feed_url: `${WEBSITE_URL}${NEWS_FEED_PATH}`,
        language: 'de',
        generator: WEBSITE_NAME,
    })

    for (const item of news) {
        const link = resolveNewsLink(item.target)
        if (!link || !link.link) {
            // Skip entries without a usable source link (e.g. a meta item whose
            // junction row lost its target); there is nothing to point readers to.
            continue
        }

        const openGraph = link.open_graph
        const title = link.title || openGraph?.title || link.link
        const description = link.comment || openGraph?.description || ''
        const enclosure = openGraph?.image ? imageEnclosure(openGraph.image) : null

        feed.item({
            title,
            description,
            url: link.link,
            // The news item id is stable across edits and independent of the
            // external URL, so it is the right permanent identifier.
            guid: item.id,
            // The meta item is created together with its link, so its
            // date_created is the publication date used for ordering and pubDate.
            date: item.date_created,
            ...(enclosure ? { enclosure } : {}),
        })
    }

    setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')

    return feed.xml({ indent: true })
})
