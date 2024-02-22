<template>
    <div v-if="homePage && latestPodcasts && podcastCount">
        <section class="container px-6 pb-24 pt-32 md:pb-32 md:pt-40 lg:px-8 lg:pb-52 lg:pt-56 2xl:pt-64">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Page intro -->
            <h1
                class="mt-3 text-2xl font-black leading-normal text-white md:mt-6 md:text-3xl md:leading-normal lg:text-6xl lg:leading-normal"
            >
                <div
                    class="inline-child inline-block h-6 md:h-8 lg:h-16"
                    alt="programmier.bar Logo"
                    v-html="brandLogoIcon"
                />
                :
                <TypedText :text="homePage.intro_heading" />
            </h1>
        </section>

        <section>
            <!-- Scroll down mouse -->
            <ScrollDownMouse />

            <!-- Video -->
            <div class="bg-gray-900">
                <video
                    v-if="!isString(homePage.video)"
                    class="min-h-80 w-full object-cover"
                    :src="videoUrl"
                    :alt="homePage.video.title || ''"
                    autoplay
                    loop
                    muted
                    playsinline
                />
            </div>

            <!-- Newsticker -->
            <NewsTicker :news="newsTicker" />
        </section>

        <!-- Podcasts -->
        <section v-if="latestPodcasts.length" class="relative py-16 md:my-14 md:py-28 lg:my-24 lg:py-36">
            <SectionHeading class="px-6 md:px-0" element="h2">
                {{ homePage.podcast_heading }}
            </SectionHeading>
            <PodcastSlider
                class="mt-10 md:mt-0"
                :podcasts="latestPodcasts"
                :podcast-count="podcastCount"
                show-podcast-link
            />
        </section>
    </div>
</template>

<script setup lang="ts">
import { isString } from '@vue/shared';
import brandLogoIcon from '~/assets/images/brand-logo.svg?raw';
import { type LatestPodcasts, useDirectus } from '~/composables/useDirectus';
import { generatePodcastSeries } from '~/helpers/jsonLdGenerator';
import { computed, type ComputedRef } from 'vue';
import { useLoadingScreen, usePageMeta } from '../composables';
import { DIRECTUS_CMS_URL } from '../config';
import type { DirectusHomePage } from '../types';

const breadcrumbs = [{ label: 'Home' }]
const directus = useDirectus()

// Query home page, latest podcasts and podcast count
const { data: pageData } = useAsyncData(async () => {
    const [homePage, latestPodcasts, podcastCount] = await Promise.all([
        await directus.getHomepage(),
        await directus.getLatestPodcasts(),
        await directus.getPodcastCount(),
    ])

    return { homePage, latestPodcasts, podcastCount }
})

// Extract home page, latest podcasts and podcast count from page data
const homePage: ComputedRef<DirectusHomePage | undefined> = computed(() => pageData.value?.homePage)
const latestPodcasts: ComputedRef<LatestPodcasts | undefined> = computed(() => pageData.value?.latestPodcasts)

const podcastCount = computed(() => pageData.value?.podcastCount)
const newsTicker = computed(() => {
    if (!pageData.value) return []

    return pageData.value.homePage.news.map((newsObject) => {
        return newsObject.text
    })
})

// Set loading screen
useLoadingScreen(homePage)

// Set page meta data
usePageMeta(homePage)

useJsonld(generatePodcastSeries())

// Create Video URL
const videoUrl = computed(() => {
    if (!isString(homePage.value?.video)) {
        return homePage.value && `${DIRECTUS_CMS_URL}/assets/${homePage.value?.video.id}`
    }

    return undefined
})
</script>

<style>
.inline-child > svg {
    display: inline;
}
</style>
