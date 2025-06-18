<template>
    <div v-if="homePage && latestPodcasts && podcastCount">
        <section class="container px-6 pb-24 pt-32 md:pb-32 md:pt-40 lg:px-8 lg:pb-52 lg:pt-56 2xl:pt-64">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Page intro -->
            <h1
                class="mt-3 text-2xl font-black leading-normal text-white md:mt-6 md:text-3xl md:leading-normal lg:text-6xl lg:leading-normal"
            >
                <BrandLogoIcon class="inline-child inline-block h-6 md:h-8 lg:h-16" />
            </h1>
            <TypedText
                class="font-azeret font-medium leading-8 text-white xs:text-base md:text-2xl"
                :text="homePage.intro_heading"
            />
            <div v-if="FLAG_SHOW_LOGIN" class="mt-10 flex flex-col items-center space-y-4 md:mt-16 lg:mt-24">
                <PrimaryPbButton class="h-14 w-48 uppercase md:hidden">
                    <NuxtLink to="/login"> Anmelden </NuxtLink>
                </PrimaryPbButton>
                <LoginButton class="h-12 w-40 md:hidden">
                    <NuxtLink to="/login"> Einloggen </NuxtLink>
                </LoginButton>
            </div>
        </section>

        <section>
            <!-- Scroll down mouse -->
            <ScrollDownMouse />

            <!-- Video -->
            <div class="bg-gray-900">
                <video
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

        <section v-if="highlightItem" class="relative py-16 md:my-14 md:py-28 lg:my-24 lg:py-36">
            <SectionHeading class="px-6 md:px-0" element="h2">
                {{ homePage.highlights_heading }}
            </SectionHeading>
            <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
                <FadeAnimation fade-in="from_right">
                    <MeetupCard v-if="highlightItemType == 'meetups'" :meetup="highlightItem" />
                </FadeAnimation>
            </div>
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

        <!-- Meetups -->
        <MeetupSection
            v-if="upcomingMeetups.length > 0"
            :heading="homePage.meetup_heading"
            :meetups="upcomingMeetups"
        />
    </div>
</template>

<script setup lang="ts">
import BrandLogoIcon from '~/assets/images/brand-logo.svg'
import PrimaryPbButton from '~/components/PrimaryPbButton.vue'
import { useDirectus } from '~/composables/useDirectus'
import { generatePodcastSeries } from '~/helpers/jsonLdGenerator'
import { computed, type ComputedRef } from 'vue'
import { useLoadingScreen, usePageMeta, usePodcastPlayer } from '../composables';
import { DIRECTUS_CMS_URL } from '../config'
import type { DirectusHomePage, LatestPodcastItem, MeetupItem } from '../types'

const FLAG_SHOW_LOGIN = useRuntimeConfig().public.FLAG_SHOW_LOGIN

const breadcrumbs = [{ label: 'Home' }]
const directus = useDirectus()
const podcastPlayer = usePodcastPlayer()

// Query home page, latest podcasts and podcast count
const { data: pageData } = useAsyncData(async () => {
    const [homePage, latestPodcasts, podcastCount, meetups] = await Promise.all([
        await directus.getHomepage(),
        await directus.getLatestPodcasts(),
        await directus.getPodcastCount(),
        await directus.getMeetups(),
    ])

    const upcomingMeetups = meetups.filter((meetup) => {
        const now = new Date()
        return new Date(meetup.start_on) > now
    })

    return { homePage, latestPodcasts, podcastCount, upcomingMeetups }
})

// Extract home page, latest podcasts and podcast count from page data
const homePage: ComputedRef<DirectusHomePage | undefined> = computed(() => pageData.value?.homePage)
const latestPodcasts: ComputedRef<LatestPodcastItem[] | undefined> = computed(() => {

  if (!podcastPlayer.podcast?.id && pageData.value?.latestPodcasts && pageData.value?.latestPodcasts.length > 0) {
    podcastPlayer.setPodcast(pageData.value?.latestPodcasts[0])
  }

  return pageData.value?.latestPodcasts
})

// Currently, we only support _one_ highlight item of the type _podcast_.
const highlightItem: ComputedRef<MeetupItem | undefined> = computed(() => {
    if (!pageData.value) {
        return
    }

    if (pageData.value.homePage.highlights.length === 0) {
        return
    }

    const highlightItem = pageData.value.homePage.highlights[0]
    if (highlightItem.collection === 'meetups') {
        return highlightItem.item
    }

    return
})
const highlightItemType: ComputedRef<string | undefined> = computed(() => {
    if (!pageData.value || pageData.value.homePage.highlights.length === 0) return

    return pageData.value.homePage.highlights[0].collection
})

const upcomingMeetups: ComputedRef<MeetupItem[]> = computed(() => {
    if (!pageData.value) return []
    // Prevent showing the highlighted item twice on the homepage
    return pageData.value.upcomingMeetups.filter((meetup) => {
        return meetup.id !== highlightItem.value?.id
    })
})

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
const videoUrl = computed(() => homePage.value && `${DIRECTUS_CMS_URL}/assets/${homePage.value?.video.id}`)
</script>

<style>
.inline-child > svg {
    display: inline;
}
</style>
