<template>
    <div class="flex items-center gap-3.5 rounded-xl border border-[#3a3d3f] bg-black p-3">
        <div class="h-16 w-16 flex-none">
            <DirectusImage
                v-if="podcast.cover_image"
                class="h-full w-full rounded object-cover"
                :image="podcast.cover_image"
                :alt="fullTitle"
                sizes="64px"
                loading="lazy"
            />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-0.75">
            <span class="text-[10px] font-black uppercase tracking-[0.15em] text-[#abb2b5]">Im Podcast besprochen</span>
            <span class="text-[15px] font-light leading-snug text-white [text-wrap:pretty]">
                <strong class="font-black">{{ typeAndNumber }}{{ divider }}</strong
                >{{ podcast.title }}
            </span>
            <span v-if="formattedDate" class="text-[13px] font-light italic text-[#abb2b5]">{{ formattedDate }}</span>
        </div>

        <button
            v-on:click="togglePlayReference"
            class="relative z-10 flex flex-none flex-col items-center gap-1.25 text-lime no-underline transition-colors hover:text-blue"
            :aria-label="`Zur Podcast-Folge: ${fullTitle}`"
            data-cursor-hover
        >
            <play_circle v-if='!isReferencePlaying' />
            <pause_circle v-else />
            <span v-if="startTimestamp" class="text-[11px] font-black tracking-[0.1em] text-current">
                <span class="uppercase opacity-70">ab</span> {{ startTimestamp }}
            </span>
        </button>
    </div>
</template>

<script setup lang="ts">
import type { DirectusPodcastItem } from '~/types/directus'
import { getFullPodcastTitle, getPodcastTitleDivider, getPodcastTypeAndNumber } from 'shared-code'
import { computed, toRefs } from 'vue'
import DirectusImage from './DirectusImage.vue'
import { usePodcastPlayer } from '~/composables';
import play_circle from '~/assets/icons/play-circle.svg'
import pause_circle from '~/assets/icons/pause-circle-filled.svg'

const props = defineProps<{
    podcast: DirectusPodcastItem
    // Start offset of the discussion within the episode, in seconds. When set,
    // an "ab mm:ss" timestamp is shown next to the play button.
    secondsFrom?: number | null
}>()
const { podcast, secondsFrom } = toRefs(props)

const podcastPlayer = usePodcastPlayer();

// "Deep Dive 142", "CTO-Special 5", … and the type-specific divider (" – ", ": ").
const typeAndNumber = computed(() => getPodcastTypeAndNumber(podcast.value))
const divider = computed(() => getPodcastTitleDivider(podcast.value))
const fullTitle = computed(() => getFullPodcastTitle(podcast.value))

const isReferencePlaying = computed(() => {
  return podcast.value && podcastPlayer.isPlaying(podcast.value)
})

const togglePlayReference = function () {
  if (podcastPlayer.isPlaying(podcast.value)) {
    podcastPlayer.pause();
  } else {
    podcastPlayer.setPodcast(podcast.value);
    podcastPlayer.setCurrentTime(secondsFrom.value || 0);
    podcastPlayer.play();
  }
}

// mm:ss (or h:mm:ss past an hour), matching the podcast player's timestamps.
const startTimestamp = computed(() => {
    const seconds = secondsFrom.value
    if (seconds === null || seconds === undefined || seconds <= 0) {
        return ''
    }
    const isoString = new Date(seconds * 1000).toISOString()
    return seconds < 3600 ? isoString.substr(14, 5) : isoString.substr(11, 8)
})

const formattedDate = computed(() =>
    podcast.value?.published_on
        ? new Date(podcast.value.published_on).toLocaleDateString('de-DE', {
              timeZone: 'Europe/Berlin',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
          })
        : ''
)
</script>
