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
            Mehr Infos
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
import { computed, ref } from 'vue'
import PlayCircleFilledIcon from '~/assets/icons/play-circle-filled.svg'
import { useVideoConsent } from '~/composables/useVideoConsent'
import { getAssetUrl } from '~/helpers/getAssetUrl'
import type { FileItem } from '~/types'

const props = defineProps<{
  url: string
  thumbnail?: FileItem | null
}>()

const { hasConsented, grantConsent } = useVideoConsent()

const rememberChoice = ref(false)
const localConsent = ref(false)
const useFallbackThumbnail = ref(false)

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
  return `https://www.youtube-nocookie.com/embed/${videoId.value}`
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
</script>
