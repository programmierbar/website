<template>
  <div class="relative w-full aspect-video bg-gray-900">
    <!-- Consent placeholder -->
    <template v-if="!showVideo">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="'Video-Vorschaubild'"
        class="absolute inset-0 h-full w-full object-cover"
        @error="onThumbnailError"
      />
      <div class="absolute inset-0 bg-black/50" />
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
        <button
          class="flex flex-col items-center gap-4"
          data-cursor-hover
          @click="handleLoadVideo"
        >
          <PlayCircleFilledIcon class="h-16 w-16 text-lime md:h-20 md:w-20" />
          <span class="rounded-full border-2 border-lime px-6 py-2 text-sm font-bold text-lime transition-colors hover:bg-lime hover:text-black md:text-base">
            Video laden
          </span>
        </button>
        <p class="mt-2 max-w-md text-center text-xs text-white/80 md:text-sm">
          Durch Klicken werden Daten an YouTube übertragen.
          <NuxtLink class="underline hover:text-white" to="/datenschutz" data-cursor-hover>
            Datenschutz
          </NuxtLink>
        </p>
        <label class="flex cursor-pointer items-center gap-2 text-xs text-white/70 md:text-sm">
          <input
            v-model="rememberChoice"
            type="checkbox"
            class="accent-lime"
          />
          Immer YouTube-Videos erlauben
        </label>
      </div>
    </template>

    <!-- Iframe (loaded after consent) -->
    <iframe
      v-else
      ref="iframeRef"
      type="text/html"
      :src="embedUrl"
      class="h-full w-full"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import PlayCircleFilledIcon from '~/assets/icons/play-circle-filled.svg'
import { createYouTubePlayerSource } from '~/composables/useMediaSource'
import { usePodcastPlayer } from '~/composables/usePodcastPlayer'
import { useVideoConsent } from '~/composables/useVideoConsent'
import { useYouTubeIframeApi } from '~/composables/useYouTubeIframeApi'
import { getAssetUrl } from '~/helpers/getAssetUrl'
import type { FileItem, PodcastItem } from '~/types'

const props = defineProps<{
  url: string
  thumbnail?: FileItem | null
  syncWithPodcastPlayer?: PodcastItem | null
}>()

const { hasConsented, grantConsent } = useVideoConsent()

const syncEnabled = computed(() => Boolean(props.syncWithPodcastPlayer))
const podcastPlayer = syncEnabled.value ? usePodcastPlayer() : null

const rememberChoice = ref(false)
const localConsent = ref(false)
const useFallbackThumbnail = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)

const showVideo = computed(() => hasConsented.value || localConsent.value)

function getVideoId(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') {
      return url.searchParams.get('v')
    }
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1)
    }
    return null
  } catch {
    return null
  }
}

const videoId = computed(() => getVideoId(props.url))

const embedUrl = computed(() => {
  if (!videoId.value) return ''
  const base = `https://www.youtube-nocookie.com/embed/${videoId.value}`
  if (!syncEnabled.value) return base
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}?enablejsapi=1&origin=${encodeURIComponent(origin)}`
})

const thumbnailUrl = computed(() => {
  if (props.thumbnail) {
    return getAssetUrl(props.thumbnail)
  }
  if (!videoId.value) return ''
  if (useFallbackThumbnail.value) {
    return `https://img.youtube.com/vi/${videoId.value}/hqdefault.jpg`
  }
  return `https://img.youtube.com/vi/${videoId.value}/maxresdefault.jpg`
})

function onThumbnailError() {
  if (!useFallbackThumbnail.value && !props.thumbnail) {
    useFallbackThumbnail.value = true
  }
}

function handleLoadVideo() {
  if (rememberChoice.value) {
    grantConsent(true)
  }
  localConsent.value = true
}

// --- Sync with the global podcast player (opt-in) -------------------------
//
// `ourSourceActive` tracks whether the bar is currently driven by *our*
// YouTube player. If the bar gets swapped to a different podcast (e.g. user
// clicks play on another PodcastCard), the composable destroys our source
// adapter, flipping this flag back to false. We check it on unmount to avoid
// handing off when the bar isn't actually following this video any more.
let player: YT.Player | null = null
let ourSourceActive = false

async function initYouTubePlayer() {
  if (!syncEnabled.value || !podcastPlayer || !props.syncWithPodcastPlayer) return
  if (player) return

  try {
    const YTApi = await useYouTubeIframeApi()
    await nextTick()
    if (!iframeRef.value) return

    player = new YTApi.Player(iframeRef.value, {
      events: {
        onReady: () => {
          if (!player || !props.syncWithPodcastPlayer || !podcastPlayer) return
          podcastPlayer.setPodcast(props.syncWithPodcastPlayer, {
            sourceFactory: (cb) => {
              const source = createYouTubePlayerSource(player!, cb)
              ourSourceActive = true
              const originalDestroy = source.destroy
              source.destroy = () => {
                ourSourceActive = false
                originalDestroy()
              }
              return source
            },
          })
          // User already clicked "Video laden" — start playback now so the
          // single click load+play feels natural.
          try {
            player.playVideo()
          } catch {
            /* autoplay may be blocked; ignore */
          }
        },
      },
    })
  } catch (error) {
    // API failed to load — keep the iframe as a plain embed, no bar sync.
    console.warn('YouTube IFrame API failed to load', error)
  }
}

watch(
  showVideo,
  (visible) => {
    if (visible && syncEnabled.value) {
      void initYouTubePlayer()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (!syncEnabled.value || !podcastPlayer || !player) return

  if (ourSourceActive) {
    let seekTime = 0
    let wasPlaying = false
    try {
      seekTime = player.getCurrentTime() ?? 0
      wasPlaying = player.getPlayerState() === YT.PlayerState.PLAYING
    } catch {
      /* player may be in an unusable state; fall back to defaults */
    }
    podcastPlayer.switchToAudioElement({ seekTime, autoplay: wasPlaying })
  }

  try {
    player.destroy()
  } catch {
    /* ignore — iframe may already be detached */
  }
  player = null
})
</script>
