<template>
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-32">
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <div class="absolute -left-20 -top-32 h-[520px] w-[520px] rounded-full bg-blue opacity-30 blur-[140px]" />
            <div
                class="absolute -bottom-36 -right-16 h-[460px] w-[460px] rounded-full bg-pink opacity-30 blur-[150px]"
            />
        </div>

        <NewsItem v-if="newsLink" :news-link="newsLink" :published-on="news?.published_on" :show-brand-mark="true" />
    </div>
</template>

<script setup lang="ts">
import NewsItem from '~/components/NewsItem.vue'
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo, resolveNewsLink } from '~/helpers'
import { computed } from 'vue'

const route = useRoute()
const directus = useDirectus()

const { data: news } = await useAsyncData(route.fullPath, () =>
    directus.getPublishedNewsBySlug(route.params.slug as string)
)

// A missing or unpublished slug is a 404, not a server error. This is thrown at
// setup level (not inside the useAsyncData handler, where it would only populate
// the error ref) so the response carries the correct status.
if (!news.value) {
    throw createError({ statusCode: 404, statusMessage: 'The news item was not found.', fatal: true })
}

// Resolve the source item behind the news entry (shared with the list view).
const newsLink = computed(() => resolveNewsLink(news.value))

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
              // Omit the published time entirely when published_on is missing
              // (a broken state) rather than substituting a different date.
              publishedAt: news.value?.published_on ? news.value.published_on.split('T')[0] : undefined,
          })
        : {}
)
</script>
