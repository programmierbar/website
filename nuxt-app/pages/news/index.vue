<template>
    <div class="container px-6 pb-24 pt-32 md:pt-40 lg:pt-48 md:pl-24 3xl:pl-0">
        <SectionHeading element="h1">News</SectionHeading>

        <!-- RSS feed link -->
        <div class="mt-8 flex justify-end md:mt-10">
            <a
                :href="NEWS_FEED_PATH"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RSS Feed - News"
                class="inline-flex items-center gap-2.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:text-blue"
                data-cursor-hover
            >
                <RssFeedIcon class="h-12 w-12" aria-hidden="true" />
            </a>
        </div>

        <ul v-if="cards.length" class="mt-4 flex flex-wrap justify-center gap-6 md:mt-6">
            <li
                v-for="card in cards"
                :key="card.news.id"
                class="flex w-full md:w-[calc(50%-12px)] xl:w-[calc(33.333%-16px)]"
            >
                <NewsItem
                    class="h-full"
                    :news-link="card.link"
                    :published-on="card.news.published_on"
                    :to="card.news.slug ? `/news/${card.news.slug}` : undefined"
                    heading-level="h2"
                />
            </li>
        </ul>

        <p v-else class="mt-12 text-center text-lg font-light text-white">Zurzeit gibt es keine News.</p>

        <!-- Infinite-scroll sentinel: fetches the next page when it scrolls into view -->
        <div v-if="hasMore" ref="sentinel" class="h-px w-full" aria-hidden="true" />
        <p v-if="loadingMore" class="mt-10 text-center text-sm font-light italic text-[#abb2b5]">
            Weitere News werden geladen …
        </p>
    </div>
</template>

<script setup lang="ts">
import RssFeedIcon from '~/assets/logos/rss-feed-color.svg'
import NewsItem from '~/components/NewsItem.vue'
import { useIntersectionObserver, useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { NEWS_FEED_PATH, NEWS_FEED_TITLE, WEBSITE_URL } from '~/config'
import { getMetaInfo, resolveNewsLink } from '~/helpers'
import type { DirectusNewsItem, DirectusNewsLinkItem } from '~/types/directus'
import { computed, ref } from 'vue'

const PAGE_SIZE = 12

const route = useRoute()
const directus = useDirectus()

// First page is fetched on the server for SSR/SEO; further pages are appended
// client-side as the user scrolls (see loadMore below).
const { data: firstPage } = await useAsyncData('news-list', () =>
    directus.getPublishedNews(PAGE_SIZE, 1, { withAuthor: true })
)

const items = ref<DirectusNewsItem[]>([...(firstPage.value ?? [])])
const page = ref(1)
const loadingMore = ref(false)
// A short final page means we've reached the end.
const hasMore = ref((firstPage.value?.length ?? 0) === PAGE_SIZE)

// Resolve each news entry to its renderable source item, dropping any that
// don't resolve (e.g. a future source type this view doesn't render yet).
const cards = computed<{ news: DirectusNewsItem; link: DirectusNewsLinkItem }[]>(() =>
    items.value
        .map((news) => ({ news, link: resolveNewsLink(news) }))
        .filter((card): card is { news: DirectusNewsItem; link: DirectusNewsLinkItem } => card.link !== null)
)

async function loadMore() {
    if (!hasMore.value || loadingMore.value) {
        return
    }

    loadingMore.value = true
    try {
        const next = await directus.getPublishedNews(PAGE_SIZE, page.value + 1, { withAuthor: true })
        page.value += 1
        items.value.push(...next)
        if (next.length < PAGE_SIZE) {
            hasMore.value = false
        }
    } finally {
        loadingMore.value = false
    }
}

const sentinel = ref<HTMLElement | null>(null)
useIntersectionObserver(sentinel, (entries) => {
    if (entries[0]?.isIntersecting) {
        loadMore()
    }
})

// Set loading screen
useLoadingScreen(firstPage)

// Set page meta data, including a feed discovery link so browsers and readers
// can auto-detect the news RSS feed.
const metaInfo = getMetaInfo({
    type: 'website',
    path: route.path,
    title: 'News',
    description: 'Kuratierte News rund um App- und Webentwicklung von der programmier.bar.',
})
useHead({
    ...metaInfo,
    link: [
        ...(metaInfo.link ?? []),
        {
            rel: 'alternate',
            type: 'application/rss+xml',
            href: `${WEBSITE_URL}${NEWS_FEED_PATH}`,
            title: NEWS_FEED_TITLE,
        },
    ],
})
</script>
