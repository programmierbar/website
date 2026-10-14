import { getFullPodcastTitle } from '../../../../../../../shared-code/index.ts'
import { escapeHtml, joinUrl } from '../escape.ts'
import { sortBySortField } from '../sort.ts'
import type { NewsletterPodcast, NewsletterPodcastsBlock } from '../types.ts'
import { headingMjml } from './heading.ts'

function podcastTitle(podcast: NewsletterPodcast): string {
    return getFullPodcastTitle({
        type: podcast.type ?? '',
        number: podcast.number as string,
        title: podcast.title ?? '',
    })
}

/** Podcasts block: optional heading plus one linked entry per selected episode, in junction order. */
export function podcastsBlockMjml(block: NewsletterPodcastsBlock, websiteUrl: string): string {
    const podcasts = sortBySortField(block.podcasts ?? [])
        .map((row) => row.podcasts_id)
        .filter((podcast): podcast is NewsletterPodcast => !!podcast && typeof podcast === 'object')

    const items = podcasts.map((podcast) => {
        const title = escapeHtml(podcastTitle(podcast))
        const content = podcast.slug
            ? `<a href="${escapeHtml(joinUrl(websiteUrl, `podcast/${encodeURIComponent(podcast.slug)}`))}">${title}</a>`
            : title
        return `<li>${content}</li>`
    })

    return `
    <mj-section css-class="block block-podcasts">
      <mj-column>
        ${headingMjml(block.heading)}
        <mj-text><ul>${items.join('')}</ul></mj-text>
      </mj-column>
    </mj-section>`
}
