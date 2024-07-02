<template>
    <div
        class="relative"
        :class="[podcast.type === 'deep_dive' && podcast.banner_image && 'md:bg-lime']"
        :data-cursor-black="!!(podcast.type === 'deep_dive' && podcast.banner_image)"
    >
        <!-- Overlay gradient top -->
        <div
            class="absolute left-0 top-0 -z-1 h-32 w-full bg-gradient-to-b to-transparent opacity-40"
            :class="[
                podcast.type === 'cto_special' ? 'from-blue' : podcast.type === 'news' ? 'from-pink' : 'from-lime',
                podcast.type === 'deep_dive' && podcast.banner_image && 'md:hidden',
            ]"
        />

        <!-- Overlay gradient bottom -->
        <div
            v-if="podcast.banner_image"
            class="absolute bottom-0 left-0 hidden h-32 w-full bg-gradient-to-t from-black to-transparent md:block"
        />

        <!-- Main content -->
        <div
            class="container relative flex items-center space-x-6 px-6 pb-8 pt-28 md:space-x-8 md:px-8 md:py-32 lg:py-36 3xl:space-x-12"
        >
            <!-- Play or stop button -->
            <button
                class="h-20 text-white md:h-32 lg:h-36"
                :class="podcast.type === 'deep_dive' && podcast.banner_image && 'md:text-black'"
                data-cursor-hover
                type="button"
                @click="playOrPausePodcast"
            >
                <component :is="playOrPauseIcon" />
            </button>

            <!-- Podcast episode info -->
            <div class="w-0 flex-grow" :class="podcast.banner_image && 'md:w-3/5 md:flex-grow-0'">
                <div
                    class="text-sm font-black uppercase tracking-widest md:text-lg lg:text-xl"
                    :class="[
                        podcast.type === 'deep_dive' && podcast.banner_image
                            ? 'text-blue md:text-black md:selection:bg-black md:selection:text-white'
                            : podcast.type === 'cto_special'
                              ? 'text-black'
                              : podcast.type === 'deep_dive' || podcast.type === 'news'
                                ? 'text-blue'
                                : 'text-white',
                        podcast.type === 'cto_special' &&
                            'inline-block bg-lime px-2 pb-2 pt-3 selection:bg-black selection:text-white',
                    ]"
                >
                    {{ type }} {{ podcast.number }} –
                </div>
                <h1
                    class="break-words text-3xl font-black leading-normal md:text-5xl lg:text-6xl"
                    :class="[
                        podcast.type === 'deep_dive'
                            ? podcast.banner_image
                                ? 'text-lime md:text-black md:selection:bg-black md:selection:text-white'
                                : 'text-lime'
                            : podcast.type === 'cto_special'
                              ? 'text-blue'
                              : podcast.type === 'news'
                                ? 'text-pink'
                                : 'text-white',
                        podcast.type === 'cto_special' ? 'mt-5 md:mt-7 lg:mt-9' : 'mt-3 md:mt-5 lg:mt-7',
                    ]"
                >
                    {{ podcast.title }}
                </h1>
                <div
                    class="mt-2 text-sm font-light italic text-white md:mt-4 md:text-lg lg:mt-6"
                    :class="podcast.type === 'deep_dive' && podcast.banner_image && 'md:text-black'"
                >
                    {{ date }}
                </div>
            </div>

            <!-- Speaker banner image -->
            <DirectusImage
                v-if="podcast.banner_image"
                class="absolute bottom-0 right-0 hidden h-52 w-auto object-cover opacity-90 md:block md:h-96 lg:h-112"
                :class="podcast.type === 'deep_dive' ? 'mix-blend-multiply' : '-z-1'"
                :image="podcast.banner_image"
                :alt="speakerName"
                sizes="md:384px lg:448px"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import PauseCircleFilledIcon from '~/assets/icons/pause-circle-filled.svg'
import PlayCircleIcon from '~/assets/icons/play-circle.svg'
import { usePodcastPlayer } from '~/composables'
import type { PodcastItem, SpeakerItem } from '~/types'
import { getFullSpeakerName, getPodcastType } from 'shared-code'
import { computed } from 'vue'
import DirectusImage from './DirectusImage.vue'

const props = defineProps<{
    podcast: Pick<
        PodcastItem,
        'id' | 'published_on' | 'slug' | 'type' | 'number' | 'title' | 'banner_image' | 'audio_url'
    > & {
        speakers: Pick<SpeakerItem, 'academic_title' | 'first_name' | 'last_name'>[]
    }
}>()

// Use podcast player
const podcastPlayer = usePodcastPlayer()

const playOrPauseIcon = computed(() => {
    const isPause = podcastPlayer.podcast && podcastPlayer.podcast.id === props.podcast.id && !podcastPlayer.paused

    return isPause ? PauseCircleFilledIcon : PlayCircleIcon
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

// Create speaker name
const speakerName = computed(() => {
    const firstSpeaker = props.podcast.speakers[0]
    return firstSpeaker ? getFullSpeakerName(firstSpeaker) : undefined
})
</script>
