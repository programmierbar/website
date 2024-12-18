<template>
    <div v-if="podcast">
        <article>
            <!-- Banner -->
            <PodcastBanner :podcast="podcast" />

            <div class="relative mt-8 md:mt-14">
                <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
                    <div class="flex items-center justify-between space-x-4">
                        <Breadcrumbs :breadcrumbs="breadcrumbs" />
                        <!-- <LikeButton /> -->
                    </div>

                    <SectionHeading class="mt-8 md:mt-0" element="h2"> Shownotes </SectionHeading>

                    <!-- Description -->
                    <InnerHtml
                        class="mt-8 space-y-8 text-base font-light leading-normal text-white md:mt-14 md:text-xl lg:text-2xl"
                        :html="podcast.description"
                    />

                    <!-- Podcast tags -->
                    <!-- TODO: Replace navigateTo() with <a> element -->
                    <TagList
                        v-if="podcast.tagsPrepared.length"
                        class="mt-10 md:mt-14"
                        :tags="podcast.tagsPrepared"
                        :on-click="
                            (tag: TagItem) =>
                                navigateTo({
                                    path: '/suche',
                                    query: { search: tag.name },
                                })
                        "
                    />

                    <!-- Pocast download and platform links -->
                    <ul class="mt-12 flex items-center space-x-4 md:mt-14">
                        <li>
                            <a
                                class="relative flex items-center justify-center rounded-full border-3 border-lime px-4 py-0.5 text-sm font-black uppercase tracking-widest text-lime md:border-4 md:px-8 md:text-base lg:text-lg"
                                :href="downloadUrl"
                                download
                                data-cursor-hover
                                @click="() => trackGoal(DOWNLOAD_PODCAST_EVENT_ID)"
                            >
                                Download
                            </a>
                        </li>
                        <li v-for="platform of platforms" :key="platform.name">
                            <a
                                class="block h-8 md:h-10 lg:h-12"
                                :href="platform.url"
                                target="_blank"
                                rel="noreferrer"
                                data-cursor-hover
                                @click="() => trackGoal(platform.eventId)"
                            >
                                <component :is="platform.icon" />
                            </a>
                        </li>
                    </ul>
                    <SimplePodcastTranscript
                        v-if="podcast.transcript"
                        :name="podcast.slug"
                        :body="podcast.transcript"
                        class="mt-12"
                    />
                    <PodcastTranscript
                        v-if="transcript"
                        :name="podcast.slug"
                        :podcast="podcast"
                        :transcript="transcript"
                        class="mt-12"
                    />
                </div>
            </div>
        </article>

        <!-- Picks of the day -->
        <section v-if="podcast.picks_of_the_day.length" class="relative">
            <div class="container mt-20 px-6 md:mt-32 md:pl-48 lg:mt-40 lg:pr-8 3xl:px-8">
                <SectionHeading element="h2">Picks of the Day</SectionHeading>
                <PickOfTheDayList class="mt-12 md:mt-0" :picks-of-the-day="podcast.picks_of_the_day" />
                <div v-if="pickOfTheDayCountString" class="mt-12 flex justify-center md:mt-16 lg:mt-20">
                    <LinkButton href="/pick-of-the-day">
                        Alle {{ pickOfTheDayCountString }} Picks of the Day
                    </LinkButton>
                </div>
            </div>
        </section>

        <!-- Speakers -->
        <section v-if="podcast.speakersPrepared.length" class="relative">
            <div class="container mt-20 px-6 md:mt-32 md:pl-48 lg:mt-40 lg:pr-8 3xl:px-8">
                <SectionHeading element="h2">Speaker Info</SectionHeading>
                <SpeakerList class="mt-12 md:mt-0" :speakers="podcast.speakersPrepared" />
                <div v-if="speakerCountString" class="mt-12 flex justify-center md:mt-20 lg:mt-28">
                    <LinkButton href="/hall-of-fame"> Alle {{ speakerCountString }} Speaker:innen </LinkButton>
                </div>
            </div>
        </section>

        <!-- Related podcasts -->
        <section v-if="relatedPodcasts && relatedPodcasts.length" class="relative mt-20 md:mt-32 lg:mt-40">
            <SectionHeading class="px-6 md:px-0" element="h2"> Verwandte Podcasts </SectionHeading>
            <PodcastSlider class="mt-12 md:mt-0" :podcasts="relatedPodcasts" />
        </section>

        <FeedbackSection class="mb-20 mt-16 md:mb-32 md:mt-24 md:pl-40 lg:mb-40 lg:mt-32 3xl:px-0" />
    </div>
</template>

<script setup lang="ts">
import AppleIcon from '~/assets/logos/apple-podcasts-color.svg'
import RssIcon from '~/assets/logos/rss-feed-color.svg'
import SpotifyIcon from '~/assets/logos/spotify-color.svg'
import YouTubeIcon from '~/assets/logos/youtube-color.svg'
import { useLoadingScreen, useLocaleString } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import {
    APPLE_PODCASTS_URL,
    BUZZSPROUT_RSS_FEED_URL,
    BUZZSPROUT_TRACKING_URL,
    DOWNLOAD_PODCAST_EVENT_ID,
    OPEN_APPLE_PODCASTS_EVENT_ID,
    OPEN_RSS_FEED_EVENT_ID,
    OPEN_SPOTIFY_EVENT_ID,
    OPEN_YOUTUBE_PODCAST_URL_EVENT_ID,
    SPOTIFY_URL,
    YOUTUBE_PODCAST_URL,
} from '~/config'
import { getMetaInfo, trackGoal } from '~/helpers'
import { generatePodcastEpisodeFromPodcast } from '~/helpers/jsonLdGenerator'
import type { PodcastItem, TagItem } from '~/types'
import { getFullPodcastTitle, getPodcastType } from 'shared-code'
import { computed, type ComputedRef } from 'vue'

// Add route and router
const route = useRoute()
const directus = useDirectus()

// Query podcast, pick of the day,
// speaker count and related podcasts
const { data: pageData } = useAsyncData(route.fullPath, async () => {
    const [podcast, pickOfTheDayCount, speakerCount] = await Promise.all([
        // Podcast
        await directus.getPodcastBySlug(route.params.slug as string),
        // Pick of the day count
        await directus.getPickOfTheDayCount(),
        // Speaker count
        await directus.getSpeakersCount(),
    ])
    // Throw error if podcast does not exist
    if (!podcast) {
        throw new Error('The podcast was not found.')
    }

    // Transcript
    const transcript = await directus.getTranscriptForPodcast(podcast)

    // Query related podcasts
    const relatedPodcasts = podcast.tagsPrepared.length ? await directus.getRelatedPodcasts(podcast) : []

    // Return podcast, pick of the day and
    // speaker count and related podcasts
    return { podcast, pickOfTheDayCount, speakerCount, relatedPodcasts, transcript }
})

// Extract podcast, pick of the day, speaker
// and related podcasts count from page data
const podcast: ComputedRef<PodcastItem | undefined> = computed(() => pageData.value?.podcast)
const pickOfTheDayCount = computed(() => pageData.value?.pickOfTheDayCount)
const speakerCount = computed(() => pageData.value?.speakerCount)
const relatedPodcasts = computed(() => pageData.value?.relatedPodcasts)
const transcript = computed(() => pageData.value?.transcript)

// Set loading screen
useLoadingScreen(podcast, pickOfTheDayCount, speakerCount)

// Convert number to local string
const pickOfTheDayCountString = useLocaleString(pickOfTheDayCount)
const speakerCountString = useLocaleString(speakerCount)

// Set page meta data
useHead(() =>
    podcast.value
        ? getMetaInfo({
              type: 'podcast',
              path: route.path,
              title: getFullPodcastTitle(podcast.value),
              description: podcast.value.description,
              publishedAt: podcast.value.published_on.split('T')[0],
              image: podcast.value.cover_image,
              audioUrl: podcast.value.audio_url || undefined,
          })
        : {}
)

useJsonld(generatePodcastEpisodeFromPodcast(podcast.value))

// Create podcast type
const type = computed(() => podcast.value && getPodcastType(podcast.value))

// Create download URL
const downloadUrl = computed(
    () => podcast.value && `${BUZZSPROUT_TRACKING_URL}/${podcast.value.audio_url}?download=true`
)

// Create breadcrumb list
const breadcrumbs = computed(() => [
    { label: 'Podcast', href: '/podcast' },
    { label: `${type.value} ${podcast.value?.number}` },
])

// Create platform list
const platforms = computed(() => [
    {
        name: 'Apple Podcast',
        icon: AppleIcon,
        url: podcast.value?.apple_url || APPLE_PODCASTS_URL,
        eventId: OPEN_APPLE_PODCASTS_EVENT_ID,
    },
    {
        name: 'Spotify',
        icon: SpotifyIcon,
        url: podcast.value?.spotify_url || SPOTIFY_URL,
        eventId: OPEN_SPOTIFY_EVENT_ID,
    },
    {
        name: 'YouTube',
        icon: YouTubeIcon,
        url: YOUTUBE_PODCAST_URL,
        eventId: OPEN_YOUTUBE_PODCAST_URL_EVENT_ID,
    },
    {
        name: 'RSS',
        icon: RssIcon,
        url: BUZZSPROUT_RSS_FEED_URL,
        eventId: OPEN_RSS_FEED_EVENT_ID,
    },
])
</script>
