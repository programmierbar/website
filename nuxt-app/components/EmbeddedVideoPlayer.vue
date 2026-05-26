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

// True when the bar is currently bound to a *different* episode than this
// page's. In that case we don't want to auto-load the video on page visit —
// it would otherwise stomp the in-progress audio of the other episode. The
// user must explicitly click "Video laden" to take over (setting
// `localConsent`).
const hasConflictingPlayback = computed(() => {
  if (!syncEnabled.value || !podcastPlayer || !props.syncWithPodcastPlayer) return false
  const current = podcastPlayer.podcast
  if (!current) return false
  return current.id !== props.syncWithPodcastPlayer.id
})

const showVideo = computed(() => {
  if (localConsent.value) return true
  if (hasConflictingPlayback.value) return false
  return hasConsented.value
})

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

          // If the bar already has *this* episode loaded (e.g. user
          // navigated away and is now returning), pick up its current
          // position so the video doesn't restart from zero. Read the
          // time before `setPodcast`, which resets `currentTime` to 0.
          const currentBarPodcast = podcastPlayer.podcast
          const sameEpisode = currentBarPodcast?.id === props.syncWithPodcastPlayer.id
          const resumeAt = sameEpisode ? podcastPlayer.currentTime : 0

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
          try {
            if (resumeAt > 0) {
              player.seekTo(resumeAt, true)
            }
            // User already clicked "Video laden" (or returned to a page
            // they previously consented on) — start playback so the
            // single-click load+play feels natural.
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

  // Capture state before tearing the player down.
  const shouldHandoff = ourSourceActive
  let seekTime = 0
  let wasPlaying = false
  if (shouldHandoff) {
    try {
      seekTime = player.getCurrentTime() ?? 0
    } catch {
      /* player may be in an unusable state; fall back to 0 */
    }
    // Use the bar's own play state rather than player.getPlayerState() —
    // by the time onBeforeUnmount runs, YT may have already flipped away
    // from PLAYING.
    wasPlaying = !podcastPlayer.paused
  }

  // Destroy the YouTube player FIRST. While the iframe is alive Chrome
  // ties media-session state to it, and starting the audio element load
  // before the iframe is gone can cause the audio fetch to fail with a
  // MEDIA_ERR_SRC_NOT_SUPPORTED ("Format error").
  try {
    player.destroy()
  } catch {
    /* ignore — iframe may already be detached */
  }
  player = null

  if (shouldHandoff) {
    podcastPlayer.switchToAudioElement({ seekTime, autoplay: wasPlaying })
  }
})
</script>
