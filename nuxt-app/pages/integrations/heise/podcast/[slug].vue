<template>
    <div v-if="podcast" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <SectionHeading class="hidden md:block" element="h2">heise.de</SectionHeading>

            <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="text-sm font-black uppercase tracking-widest text-blue md:text-lg lg:text-xl">
                    // Podcast für heise.de
                </div>
                <HeiseCopyButton v-if="podcast.title" label="Titel" :content="titleContent" />
            </div>
            <h1
                v-if="podcast.title"
                class="mt-3 break-words text-3xl font-black leading-normal text-lime md:mt-5 md:text-5xl lg:mt-7 lg:text-6xl"
            >
                {{ podcast.title }}
            </h1>
            <HeiseMissingValue v-else class="mt-3 md:mt-5 lg:mt-7">
                Der Titel für heise.de ist noch nicht hinterlegt.
            </HeiseMissingValue>
            <div v-if="publishedOn" class="mt-2 text-sm font-light italic text-white md:mt-4 md:text-lg lg:mt-6">
                Veröffentlichung: {{ publishedOn }}
            </div>
            <HeiseMissingValue v-else class="mt-2 md:mt-4 lg:mt-6">
                Noch kein Veröffentlichungsdatum hinterlegt.
            </HeiseMissingValue>

            <div class="mt-12 flex flex-col gap-12 md:mt-16 lg:flex-row lg:gap-16">
                <HeisePodcastCover class="lg:w-2/5 lg:flex-none" :cover="podcast.cover" />
                <div class="flex-grow space-y-12">
                    <HeisePodcastText label="Anriss" :html="podcast.anriss" />
                    <HeisePodcastPeople :guests="podcast.guests" :hosts="podcast.hosts" />
                    <HeisePodcastLinks :episode-url="episodeUrl" :youtube-url="podcast.youtubeUrl" />
                </div>
            </div>

            <HeisePodcastText class="mt-16 md:mt-24" label="Volltext" :html="podcast.text" />
            <HeisePodcastText class="mt-16 md:mt-24" label="Abspann" :html="FOOTER_HTML" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '~/composables'
import {
    BLUESKY_URL,
    INSTAGRAM_URL,
    LINKEDIN_URL,
    MASTODON_URL,
    PODCAST_CONTACT_EMAIL,
    TIKTOK_URL,
    WEBSITE_URL,
} from '~/config'
import { getMetaInfo, parseCmsDate } from '~/helpers'
import { computed } from 'vue'

// Closes every episode on heise.de. The same for all episodes, so it lives here, not in the CMS.
const FOOTER_HTML =
    '<p>Mehr Details zu dieser und allen anderen Folgen finden sich auch unter ' +
    '<a href="https://programmier.bar">https://programmier.bar</a>. Fragen und Anregungen gerne an ' +
    `<a href="mailto:${PODCAST_CONTACT_EMAIL}">${PODCAST_CONTACT_EMAIL}</a> oder via ` +
    `<a href="${MASTODON_URL}">Mastodon</a>, <a href="${BLUESKY_URL}">Bluesky</a>, ` +
    `<a href="${LINKEDIN_URL}">LinkedIn</a>, <a href="${INSTAGRAM_URL}">Instagram</a> oder ` +
    `<a href="${TIKTOK_URL}">TikTok</a>.</p>`

// Pinned to Berlin, so the server and the browser render the same time
const PUBLISHED_ON_FORMAT = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
})

const route = useRoute()
const slug = route.params.slug as string

const { data: podcast, error } = await useFetch(`/api/integrations/heise/podcast/${encodeURIComponent(slug)}`, {
    query: { token: route.query.token },
})

// Thrown at setup level so the response carries the status, as on the podcast page
if (error.value?.statusCode === 404) {
    throw createError({ statusCode: 404, statusMessage: 'The podcast was not found.', fatal: true })
}
if (error.value || !podcast.value) {
    throw createError({
        statusCode: 500,
        statusMessage: error.value?.message || 'Failed to load podcast.',
        fatal: true,
        cause: error.value,
    })
}

useLoadingScreen(podcast)

const titleContent = () => (podcast.value?.title ? { text: podcast.value.title } : null)

const episodeUrl = computed(() => `${WEBSITE_URL}/podcast/${podcast.value?.slug}`)

const publishedOn = computed(() =>
    podcast.value?.publishedOn ? `${PUBLISHED_ON_FORMAT.format(parseCmsDate(podcast.value.publishedOn))} Uhr` : null
)

useHead(() =>
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: podcast.value?.title ? `heise.de: ${podcast.value.title}` : 'heise.de',
        noIndex: true,
    })
)
</script>
