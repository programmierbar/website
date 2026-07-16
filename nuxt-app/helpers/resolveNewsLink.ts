import type { DirectusNewsItem, DirectusNewsLinkItem } from '~/types/directus'

/**
 * Resolves the source item behind a `news` meta entry. `news` references its
 * content through the m2a `target` junction; today the only source type is
 * `news_links`. When other source types (e.g. `news_event`) are added, this is
 * the single place that maps a news entry to its renderable source item.
 *
 * @param news The news item read with its `target.target` expanded.
 *
 * @returns The resolved `news_links` item, or `null` if none is present.
 */
export function resolveNewsLink(news: DirectusNewsItem | null | undefined): DirectusNewsLinkItem | null {
    const entry = news?.target?.find(
        (row) => row.collection === 'news_links' && typeof row.target === 'object' && row.target !== null
    )

    return (entry?.target as DirectusNewsLinkItem) ?? null
}
