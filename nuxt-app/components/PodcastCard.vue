<template>
    <div class="relative w-48 md:w-64 lg:w-96">
        <NuxtLink class="relative" :to="href" draggable="false" data-cursor-more>
            <!-- Podcast cover -->
            <DirectusImage
                class="pointer-events-none h-48 w-48 md:h-64 md:w-64 lg:h-96 lg:w-96"
                :image="podcast.cover_image"
                :alt="fullTitle"
                sizes="xs:192px md:256px lg:384px"
                loading="lazy"
            />
        </NuxtLink>

        <!-- Podcast date -->
        <div class="mt-4 hidden text-sm font-light italic text-white md:block lg:text-base">
            {{ date }}
        </div>

        <div class="mt-3 flex space-x-4 transition-all duration-500">
            <!-- Podcast play or pause button -->
            <button
                class="text-lime h-10 md:h-12"
                type="button"
                data-cursor-hover
                @click="playOrPausePodcast"
                v-html="playOrPauseIcon"
            />

            <div class="w-4/5">
                <!-- Podcast title -->
                <h2 class="line-clamp-2 text-sm font-light text-white md:text-lg lg:text-xl">
                    <strong v-if="podcast.type !== 'other'" class="font-black">
                        {{ type }} {{ podcast.number }}{{ divider }}
                    </strong>
                    {{ podcast.title }}
                </h2>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import pauseCircleFilledIcon from '~/assets/icons/pause-circle-filled.svg?raw'
import playCircleIcon from '~/assets/icons/play-circle.svg?raw'
import { usePodcastPlayer } from '~/composables'
import type { PodcastItem } from '~/types'
import { getFullPodcastTitle, getPodcastTitleDivider, getPodcastType } from 'shared-code'
import { computed } from 'vue'
import DirectusImage from './DirectusImage.vue'

const props = defineProps<{
    podcast: Pick<
        PodcastItem,
        'id' | 'slug' | 'published_on' | 'type' | 'number' | 'title' | 'cover_image' | 'audio_url'
    >
}>()

// Use podcast player
const podcastPlayer = usePodcastPlayer()

const playOrPauseIcon = computed(() => {
    const isPause = podcastPlayer.podcast && podcastPlayer.podcast.id === props.podcast.id && !podcastPlayer.paused

    return isPause ? pauseCircleFilledIcon : playCircleIcon
})

/**
 * It plays or pauses the podcast.
 */
const playOrPausePodcast = () => {
    if (podcastPlayer.podcast?.id !== props.podcast.id) {
        podcastPlayer.setPodcast(props.podcast)
    }
    if (podcastPlayer.paused) {
        podcastPlayer.play()
    } else {
        podcastPlayer.pause()
    }
}

// Create local date string
const date = computed(() =>
    new Date(props.podcast.published_on).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
)

// Create podcast type
const type = computed(() => getPodcastType(props.podcast))

// Create divider between podcast type and title
const divider = computed(() => getPodcastTitleDivider(props.podcast))

// Create full podcast title
const fullTitle = computed(() => getFullPodcastTitle(props.podcast))

// Create href to podcast subpage
const href = computed(() => `/podcast/${props.podcast.slug}`)
</script>
