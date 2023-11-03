<template>
    <div v-if="meetup">
        <article class="relative">
            <div class="container px-6 pt-32 md:pl-48 md:pt-40 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
                <div class="flex items-center justify-between space-x-4">
                    <Breadcrumbs :breadcrumbs="breadcrumbs" />
                    <!-- <LikeButton /> -->
                </div>

                <h1
                    class="mt-12 text-2xl font-black leading-normal text-white md:mt-16 md:text-4xl md:leading-normal lg:mt-20 lg:text-5xl lg:leading-normal"
                >
                    {{ meetup.title }}
                </h1>

                <div class="xl:flex xl:items-end xl:space-x-12">
                    <!-- Cover and YouTube -->
                    <a
                        v-if="meetup.youtube_url"
                        class="relative mt-10 flex items-center justify-center md:mt-12 lg:mt-16 xl:w-2/3"
                        :href="meetup.youtube_url"
                        target="_blank"
                        rel="noreferrer"
                        data-cursor-hover
                        @click="() => trackGoal(OPEN_YOUTUBE_EVENT_ID)"
                    >
                        <div
                            class="pointer-events-none absolute z-10 h-20 text-blue text-opacity-90 xs:h-24 md:h-28 lg:h-40"
                            v-html="playCircleFilledIcon"
                        />
                        <MeetupCover class="w-full" :meetup="meetup" />
                    </a>
                    <MeetupCover v-else class="mt-10 md:mt-12 lg:mt-16 xl:w-2/3" :meetup="meetup" />

                    <!-- Meetup, calendar & maps -->
                    <MeetupCalendarAndMaps class="hidden xl:flex xl:w-1/4" :meetup="meetup" />
                </div>

                <!-- Start and end time -->
                <MeetupStartAndEnd
                    class="mt-10 text-sm font-bold italic text-lime md:mt-16 md:text-lg lg:mt-24 lg:text-xl"
                    :meetup="meetup"
                />

                <!-- Heading and description -->
                <SectionHeading class="hidden md:block" element="h2"> Meetup Infos </SectionHeading>
                <InnerHtml
                    class="mt-8 space-y-8 text-base font-light leading-normal text-white md:mt-14 md:text-xl lg:text-2xl"
                    :html="meetup.description"
                />
                <p class="text-base font-light leading-normal text-white md:mt-14 md:text-xl lg:text-2xl">Bitte beachte auch unsere <NuxtLink
                  class="hover:text-lime hover:underline"
                  data-cursor-hover
                  :to="'/verhaltensregeln'"
                >Verhaltensregeln</NuxtLink
                >.</p>

                <!-- Meetup tags -->
                <!-- TODO: Replace navigateTo() with <a> element -->
                <TagList
                    v-if="meetup.tagsPrepared.length"
                    class="mt-10 md:mt-14"
                    :tags="meetup.tagsPrepared"
                    :on-click="
                        (tag: TagItem) =>
                            navigateTo({
                                path: '/suche',
                                query: { search: tag.name },
                            })
                    "
                />

                <!-- Meetup, calendar & maps -->
                <MeetupCalendarAndMaps class="mt-16 md:mt-20 xl:hidden" :meetup="meetup" />
            </div>
        </article>

        <!-- Speakers -->
        <section v-if="meetup.speakersPrepared.length" class="relative">
            <div class="container mt-20 px-6 md:mt-32 md:pl-48 lg:mt-40 lg:pr-8 3xl:px-8">
                <SectionHeading element="h2">Speaker Info</SectionHeading>
                <SpeakerList class="mt-12 md:mt-0" :speakers="meetup.speakersPrepared" />
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
import playCircleFilledIcon from '~/assets/icons/play-circle-filled.svg?raw'
import { useLoadingScreen, useLocaleString } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { OPEN_YOUTUBE_EVENT_ID } from '~/config'
import { getMetaInfo, trackGoal } from '~/helpers'
import type { MeetupItem, TagItem } from '~/types'
import { computed, type ComputedRef } from 'vue'

// Add route and router
const route = useRoute()

const directus = useDirectus()

// Query meetup, speaker count and related podcast
const { data: pageData } = useAsyncData(route.fullPath, async () => {
    // Query meetup and speaker count async
    const [meetup, speakerCount] = await Promise.all([
        await directus.getMeetupBySlug(route.params.slug as string),
        await directus.getSpeakersCount(),
    ])

    // Throw error if meetup does not exist
    if (!meetup) {
        throw new Error('The meetup was not found.')
    }

    // Query related podcasts
    const relatedPodcasts = meetup.tagsPrepared.length ? await directus.getRelatedPodcasts(meetup) : []

    // Return meetup, speaker count and related podcast
    return { meetup, speakerCount, relatedPodcasts }
})

// Extract meetup, speaker count and related podcasts from page data
const meetup: ComputedRef<MeetupItem | undefined> = computed(() => pageData.value?.meetup)
const speakerCount = computed(() => pageData.value?.speakerCount)
const relatedPodcasts = computed(() => pageData.value?.relatedPodcasts)

// Convert speaker count to local string
const speakerCountString = useLocaleString(speakerCount)

// Set loading screen
useLoadingScreen(meetup, speakerCount)

// Set page meta data
useHead(() =>
    meetup.value
        ? getMetaInfo({
              type: 'article',
              path: route.path,
              title: meetup.value.title,
              description: meetup.value.description,
              image: meetup.value.cover_image,
              publishedAt: meetup.value.published_on.split('T')[0],
          })
        : {}
)

// Create breadcrumb list
const breadcrumbs = computed(() => [{ label: 'Meetup', href: '/meetup' }, { label: meetup.value?.title || '' }])
</script>
