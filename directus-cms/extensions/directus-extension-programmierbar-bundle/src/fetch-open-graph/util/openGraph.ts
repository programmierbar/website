import { parse } from 'node-html-parser'

/**
 * The curated, normalized Open Graph fields we expose for reliable access,
 * alongside the full bag of retrieved tags under `raw`.
 */
export interface OpenGraph {
    title?: string
    description?: string
    image?: string
    url?: string
    site_name?: string
    type?: string
    /** Every meta tag we could extract, keyed by its property/name (e.g. `og:title`, `twitter:card`, `description`). */
    raw: Record<string, string>
}

/**
 * Collect the relevant meta tags from an HTML document into a flat map keyed by
 * the tag's `property` (Open Graph) or `name` (Twitter cards, `description`),
 * plus the document `<title>` under the pseudo-key `title`.
 *
 * @param html The raw HTML body of the fetched page.
 */
export function parseMetaTags(html: string): Record<string, string> {
    const root = parse(html)
    const tags: Record<string, string> = {}

    for (const meta of root.querySelectorAll('meta')) {
        const key = meta.getAttribute('property') ?? meta.getAttribute('name')
        const content = meta.getAttribute('content')

        if (!key || content === undefined || content === null) {
            continue
        }

        // Keep the first occurrence of each tag (pages sometimes repeat tags).
        if (!(key in tags)) {
            tags[key] = content
        }
    }

    const titleEl = root.querySelector('title')
    const titleText = titleEl?.text?.trim()
    if (titleText) {
        tags.title = titleText
    }

    return tags
}

/**
 * Resolve a possibly-relative URL against the page it was found on. Returns the
 * original value if it cannot be resolved.
 */
function resolveUrl(value: string | undefined, pageUrl: string): string | undefined {
    if (!value) {
        return undefined
    }
    try {
        return new URL(value, pageUrl).toString()
    } catch {
        return value
    }
}

/**
 * Build the curated Open Graph object from the extracted tags, falling back
 * from Open Graph to Twitter-card tags to plain HTML where needed.
 *
 * @param tags The flat meta-tag map from {@link parseMetaTags}.
 * @param pageUrl The URL the page was fetched from (used for `url` fallback and to absolutize the image).
 */
export function normalizeOpenGraph(tags: Record<string, string>, pageUrl: string): Omit<OpenGraph, 'raw'> {
    return {
        title: tags['og:title'] ?? tags['twitter:title'] ?? tags.title,
        description: tags['og:description'] ?? tags['twitter:description'] ?? tags.description,
        image: resolveUrl(tags['og:image'] ?? tags['twitter:image'], pageUrl),
        url: tags['og:url'] ?? pageUrl,
        site_name: tags['og:site_name'],
        type: tags['og:type'],
    }
}

/**
 * Parse an HTML page into the {@link OpenGraph} structure stored in the
 * `news_links.open_graph` field: curated normalized fields plus the full `raw`
 * tag map for later reference.
 *
 * @param html The raw HTML body of the fetched page.
 * @param pageUrl The URL the page was fetched from.
 */
export function buildOpenGraph(html: string, pageUrl: string): OpenGraph {
    const raw = parseMetaTags(html)
    return {
        ...normalizeOpenGraph(raw, pageUrl),
        raw,
    }
}
