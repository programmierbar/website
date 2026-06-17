<template>
  <div class="relative">
    <!-- Spotlight glow — the signature blurred blue/pink light behind the stage.
         Each spotlight matches the Figma spec (671px circle, opacity .8,
         blur 150px). The soft blur halo provides the bleed past the frame; the
         circle boxes themselves are sized down on smaller screens so they never
         push the page wider than the viewport. -->
    <div v-if="spotlights" class="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div
        class="absolute left-0 top-0 h-64 w-64 rounded-full bg-blue opacity-80 blur-[150px] md:h-96 md:w-96 lg:h-160 lg:w-160"
      />
      <div
        class="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-pink opacity-80 blur-[150px] md:h-96 md:w-96  lg:h-160 lg:w-160"
      />
    </div>

    <!-- Stage — sharp frame with a fine lime hairline -->
    <div class="relative z-10 aspect-video w-full overflow-hidden bg-gray-900 outline outline-1 -outline-offset-1 outline-lime/40">
      <!-- Consent placeholder -->
      <template v-if="!showVideo">
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          alt="Video-Vorschaubild"
          class="absolute inset-0 h-full w-full object-cover"
          @error="onThumbnailError"
        />
        <div class="absolute inset-0 bg-black/50" />

        <!-- Brand overlay (episode + link to YouTube) -->
        <div class="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-4 md:px-5">
          <a
            :href="url"
            target="_blank"
            rel="noreferrer"
            class="ml-auto inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:text-lime"
            data-cursor-hover
          >
            <LeaveSiteIcon class="h-4 w-4" />
            Auf YouTube ansehen
          </a>
        </div>

        <!-- Center play button with pulse glow -->
        <div class="absolute inset-0 flex items-center justify-center">
          <button
            class="embedded-video-player__pulse relative rounded-full text-lime transition-transform hover:scale-105"
            aria-label="Video laden"
            data-cursor-hover
            @click="handleLoadVideo"
          >
            <PlayCircleFilledIcon class="h-20 w-20 md:h-24 md:w-24" />
          </button>
        </div>

        <!-- Consent bar -->
        <div class="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 py-5 md:px-6">
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <button
              class="inline-flex items-center gap-2 rounded-full border-3 border-lime px-6 py-2 text-sm font-black uppercase tracking-widest text-lime transition-colors hover:bg-lime hover:text-black"
              data-cursor-hover
              @click="handleLoadVideo"
            >
              <PlayIcon class="h-4 w-4" />
              Video laden
            </button>
            <p class="text-xs font-light text-white/80">
              Es werden Daten an YouTube übertragen.
              <NuxtLink class="text-blue underline hover:text-white" to="/datenschutz" data-cursor-hover>
                Datenschutz
              </NuxtLink>
            </p>
            <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-white/70">
              <input
                v-model="rememberChoice"
                type="checkbox"
                class="h-4 w-4 accent-lime"
              />
              Immer erlauben
            </label>
          </div>
        </div>
      </template>

      <!-- Iframe (loaded after consent) — native YouTube controls -->
      <template v-else>
        <iframe
          ref="iframeRef"
          type="text/html"
          :src="embedUrl"
          class="absolute inset-0 h-full w-full"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
        <!-- Persistent brand overlay above the native chrome -->
        <!-- <div class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-4 md:px-5">
          <a
            :href="url"
            target="_blank"
            rel="noreferrer"
            class="pointer-events-auto ml-auto inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:text-lime"
            data-cursor-hover
          >
            <LeaveSiteIcon class="h-4 w-4" />
            Auf YouTube ansehen
          </a>
        </div>-->
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import LeaveSiteIcon from '~/assets/icons/leave-site.svg'
import PlayIcon from '~/assets/icons/play.svg'
import PlayCircleFilledIcon from '~/assets/icons/play-circle-filled.svg'
import { createYouTubePlayerSource } from '~/composables/useMediaSource'
import { usePodcastPlayer } from '~/composables/usePodcastPlayer'
import { useVideoConsent } from '~/composables/useVideoConsent'
import { useYouTubeIframeApi } from '~/composables/useYouTubeIframeApi'
import { getAssetUrl } from '~/helpers/getAssetUrl'
import type { FileItem, PodcastItem } from '~/types'

const props = withDefaults(
  defineProps<{
    url: string
    thumbnail?: FileItem | null
    syncWithPodcastPlayer?: PodcastItem | null
    spotlights: boolean
  }>(),
  {
    spotlights: false,
  }
)

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

<style scoped>
.embedded-video-player__pulse::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    box-shadow: 0 0 0 0 rgba(207, 255, 0, 0.55);
    animation: embedded-video-player-pulse 2.6s ease-out infinite;
}

@keyframes embedded-video-player-pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(207, 255, 0, 0.5);
    }
    70% {
        box-shadow: 0 0 0 26px rgba(207, 255, 0, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(207, 255, 0, 0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .embedded-video-player__pulse::after {
        animation: none;
    }
}
</style>
