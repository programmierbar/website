<template>
    <NewsItem v-if="newsLink" :news-link="newsLink" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import NewsItem from '~/components/NewsItem.vue'
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import type { DirectusNewsLinkItem } from '~/types/directus'

const route = useRoute()
const directus = useDirectus()

const { data: news } = useAsyncData(route.fullPath, async () => {
    const item = await directus.getPublishedNewsBySlug(route.params.slug as string)

    // Throw error if the news item does not exist (or is not published)
    if (!item) {
        throw new Error('The news item was not found.')
    }

    return item
})

// Resolve the source item behind the news entry. Today the only source type is
// `news_links`; when others (e.g. `news_event`) are added, this is where they
// get mapped to a renderable shape.
const newsLink = computed<DirectusNewsLinkItem | null>(() => {
    const entry = news.value?.target?.find(
        (row) => row.collection === 'news_links' && typeof row.target === 'object' && row.target !== null
    )
    return (entry?.target as DirectusNewsLinkItem) ?? null
})

// Set loading screen
useLoadingScreen(news)

// Set page meta data
useHead(() =>
    newsLink.value
        ? getMetaInfo({
              type: 'article',
              path: route.path,
              title: newsLink.value.title,
              description: newsLink.value.comment || newsLink.value.open_graph?.description || '',
              publishedAt: newsLink.value.date_created.split('T')[0],
          })
        : {}
)
</script>
