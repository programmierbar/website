<template>
    <div v-if="speaker">
        <article class="relative">
            <!-- Overlay gradient top -->
            <div
                class="absolute left-0 top-0 -z-1 h-32 w-full bg-gradient-to-b to-transparent opacity-40"
                :class="color === 'lime' ? 'from-lime' : color === 'pink' ? 'from-pink' : 'from-blue'"
            />

            <!-- Speaker content -->
            <div class="container px-6 pt-32 md:pl-48 md:pt-40 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
                <div class="flex items-center justify-between space-x-4">
                    <Breadcrumbs :breadcrumbs="breadcrumbs" />
                    <!-- <LikeButton /> -->
                </div>

                <SectionHeading class="hidden md:block" element="h2"> Informationen </SectionHeading>

                <div
                    class="mt-14 flex flex-col space-y-10 xs:flex-row xs:items-center xs:space-x-10 xs:space-y-0 md:mt-24 md:space-x-14 lg:space-x-16 xl:mt-36"
                >
                    <!-- Profile image -->
                    <DirectusImage
                        class="h-44 w-44 flex-shrink-0 overflow-hidden rounded-full object-cover sm:h-52 sm:w-52 lg:h-80 lg:w-80 xl:h-96 xl:w-96 2xl:h-112 2xl:w-112 3xl:h-120 3xl:w-120"
                        :image="speaker.profile_image"
                        :alt="fullName"
                        sizes="xs:176px sm:208px lg:320px xl:384px 2xl:448 3xl:480px"
                    />

                    <!-- Name, Occupation & Links -->
                    <div>
                        <h1
                            class="text-4xl font-black leading-tight sm:text-5xl lg:text-7xl xl:text-8xl 2xl:text-9xl"
                            :class="color === 'lime' ? 'text-lime' : color === 'pink' ? 'text-pink' : 'text-blue'"
                        >
                            {{ fullName }}
                        </h1>
                        <div class="mt-6 text-base font-bold text-white md:mt-8 md:text-xl lg:text-2xl">
                            {{ speaker.occupation }}
                        </div>
                        <ul v-if="platforms.length" class="mt-6 flex space-x-6">
                            <li v-for="platform of platforms" :key="platform.name">
                                <a
                                    class="block h-7 text-white md:h-8 lg:h-10"
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
                    </div>
                </div>

                <!-- Description -->
                <InnerHtml
                    class="mt-8 space-y-8 text-base font-light leading-normal text-white md:mt-24 md:text-xl lg:text-2xl xl:mt-36"
                    :html="speaker.description"
                />

                <!-- Speaker tags -->
                <!-- TODO: Replace navigateTo() with <a> element -->
                <TagList
                    v-if="speaker.tagsPrepared.length"
                    class="mt-10 md:mt-14"
                    :tags="speaker.tagsPrepared"
                    :on-click="
                        (tag: TagItem) =>
                            navigateTo({
                                path: '/suche',
                                query: { search: tag.name },
                            })
                    "
                />
            </div>
        </article>

        <!-- More content -->
        <section
            v-if="speaker.podcasts.length || speaker.picks_of_the_day.length"
            class="relative mt-20 md:mt-32 lg:mt-40"
        >
            <SectionHeading class="px-6 md:px-0" element="h2"> Verwandter Inhalt </SectionHeading>

            <!-- Podcasts -->
            <PodcastSlider class="mt-12 md:mt-0" :podcasts="speaker.podcastsPrepared" />
            <div
                v-if="podcastCountString"
                class="mt-12 flex justify-center px-6 md:mt-16 md:pl-48 lg:mt-20 lg:pr-8 3xl:px-8"
            >
                <LinkButton href="/podcast"> Alle {{ podcastCountString }} Podcast-Folgen </LinkButton>
            </div>
        </section>
        <!-- Picks of the Day -->
        <div
            v-if="speaker.picks_of_the_day.length"
            class="container mt-20 px-6 md:mt-32 md:pl-48 lg:mt-40 lg:pr-8 3xl:px-8"
        >
            <PickOfTheDayList :picks-of-the-day="speaker.picks_of_the_day" />
            <div v-if="pickOfTheDayCountString" class="mt-12 flex justify-center md:mt-16 lg:mt-20">
                <LinkButton href="/pick-of-the-day"> Alle {{ pickOfTheDayCountString }} Picks of the Day </LinkButton>
            </div>
        </div>
        <!-- Feedback CTA -->
        <FeedbackSection class="mb-20 mt-16 md:mb-32 md:mt-24 md:pl-40 lg:mb-40 lg:mt-32 3xl:px-0" />
    </div>
</template>

<script setup lang="ts">
import BlueskyIcon from '~/assets/logos/bluesky-color.svg'
import GithubIcon from '~/assets/logos/github.svg'
import InstagramIcon from '~/assets/logos/instagram-color.svg'
import LinkedinIcon from '~/assets/logos/linkedin-color.svg'
import TwitterIcon from '~/assets/logos/twitter-color.svg'
import WebsiteIcon from '~/assets/logos/website-color.svg'
import YoutubeIcon from '~/assets/logos/youtube-color.svg'
import { useLoadingScreen, useLocaleString } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import {
    OPEN_SPEAKER_BLUESKY_EVENT_ID,
    OPEN_SPEAKER_GITHUB_EVENT_ID,
    OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
    OPEN_SPEAKER_LINKEDIN_EVENT_ID,
    OPEN_SPEAKER_TWITTER_EVENT_ID,
    OPEN_SPEAKER_WEBSITE_EVENT_ID,
    OPEN_SPEAKER_YOUTUBE_EVENT_ID,
} from '~/config'
import { getMetaInfo, trackGoal } from '~/helpers'
import { generatePersonFromSpeaker } from '~/helpers/jsonLdGenerator'
import type { TagItem } from '~/types'
import { getFullSpeakerName } from 'shared-code'
import { computed } from 'vue'

const directus = useDirectus()

// Add route and router
const route = useRoute()

// Query speaker, podcast and pick of the day count
const { data: pageData } = useAsyncData(route.fullPath, async () => {
    // Query speaker, podcast and pick of the day count async
    const [speaker, podcastCount, pickOfTheDayCount] = await Promise.all([
        directus.getSpeakerBySlug(route.params.slug as string),
        directus.getPodcastCount(),
        directus.getPickOfTheDayCount(),
    ])

    // Throw error if speaker does not exist
    if (!speaker) {
        throw new Error('The speaker was not found.')
    }

    // Return speaker, podcast and pick of the day count
    return { speaker, podcastCount, pickOfTheDayCount }
})

// Extract speaker, podcast and pick of the day count from page data
const speaker = computed(() => pageData.value?.speaker)
const podcastCount = computed(() => pageData.value?.podcastCount)
const pickOfTheDayCount = computed(() => pageData.value?.pickOfTheDayCount)

// Set loading screen
useLoadingScreen(speaker, podcastCount, pickOfTheDayCount)

// Convert number to local string
const podcastCountString = useLocaleString(podcastCount)
const pickOfTheDayCountString = useLocaleString(pickOfTheDayCount)

// Get color from search param
const color = computed(() => new URLSearchParams(route.fullPath.split('?')[1]).get('color') || 'blue')

// Create full name
const fullName = computed(() => speaker.value && getFullSpeakerName(speaker.value))

if (speaker.value) {
    useJsonld(generatePersonFromSpeaker(speaker.value))
}

// Set page meta data
useHead(() =>
    speaker.value
        ? getMetaInfo({
              type: 'profile',
              path: route.path,
              title: fullName.value || 'Speaker',
              description: speaker.value.description,
              image: speaker.value.profile_image,
              firstName: speaker.value.first_name,
              lastName: speaker.value.last_name,
          })
        : {}
)

// Create breadcrumb list
const breadcrumbs = computed(() => [{ label: 'Hall of Fame', href: '/hall-of-fame' }, { label: fullName.value || '' }])

// Create platform list
const platforms = computed(
    () =>
        [
            {
                name: 'Twitter',
                icon: TwitterIcon,
                url: speaker.value?.twitter_url,
                eventId: OPEN_SPEAKER_TWITTER_EVENT_ID,
            },
            {
                name: 'Bluesky',
                icon: BlueskyIcon,
                url: speaker.value?.bluesky_url,
                eventId: OPEN_SPEAKER_BLUESKY_EVENT_ID,
            },
            {
                name: 'LinkedIn',
                icon: LinkedinIcon,
                url: speaker.value?.linkedin_url,
                eventId: OPEN_SPEAKER_LINKEDIN_EVENT_ID,
            },
            {
                name: 'Instagram',
                icon: InstagramIcon,
                url: speaker.value?.instagram_url,
                eventId: OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
            },
            {
                name: 'GitHub',
                icon: GithubIcon,
                url: speaker.value?.github_url,
                eventId: OPEN_SPEAKER_GITHUB_EVENT_ID,
            },
            {
                name: 'YouTube',
                icon: YoutubeIcon,
                url: speaker.value?.youtube_url,
                eventId: OPEN_SPEAKER_YOUTUBE_EVENT_ID,
            },
            {
                name: 'Website',
                icon: WebsiteIcon,
                url: speaker.value?.website_url,
                eventId: OPEN_SPEAKER_WEBSITE_EVENT_ID,
            },
        ].filter((platform) => platform.url) as {
            name: string
            icon: string
            url: string
            eventId: string
        }[]
)
</script>
