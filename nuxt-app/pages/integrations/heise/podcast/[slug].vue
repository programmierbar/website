<template>
    <div v-if="podcast" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <SectionHeading class="hidden md:block" element="h2">heise.de</SectionHeading>

            <div class="text-sm font-black uppercase tracking-widest text-blue md:text-lg lg:text-xl">
                // Podcast für heise.de
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

            <div class="mt-12 flex flex-col gap-12 md:mt-16 lg:flex-row lg:gap-16">
                <HeisePodcastCover class="lg:w-2/5 lg:flex-none" :cover="podcast.cover" />
                <div class="flex-grow space-y-12">
                    <HeisePodcastText label="Anriss" :html="podcast.anriss" />
                    <HeisePodcastLinks :episode-url="episodeUrl" :youtube-url="podcast.youtubeUrl" />
                </div>
            </div>

            <HeisePodcastText class="mt-16 md:mt-24" label="Volltext" :html="podcast.text" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '~/composables'
import { WEBSITE_URL } from '~/config'
import { getMetaInfo } from '~/helpers'
import { computed } from 'vue'

const route = useRoute()
const slug = route.params.slug as string

const { data: podcast, error } = await useFetch(`/api/integrations/heise/podcast/${encodeURIComponent(slug)}`)

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

const episodeUrl = computed(() => `${WEBSITE_URL}/podcast/${podcast.value?.slug}`)

useHead(() =>
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: podcast.value?.title ? `heise.de: ${podcast.value.title}` : 'heise.de',
        noIndex: true,
    })
)
</script>
