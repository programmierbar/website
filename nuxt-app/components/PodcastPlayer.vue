<template>
  <div
    class="transition-all"
    :class="podcastPlayer.podcast ? 'h-16 md:h-20' : 'h-0'"
  >
    <div
      class="
        w-full
        lg:h-20
        fixed
        z-20
        left-0
        bottom-0
        flex flex-col
        lg:flex-row
        bg-lime
        transition-transform
        duration-300
        lg:space-x-16 lg:px-8
      "
      :class="
        !podcastPlayer.podcast
          ? 'translate-y-full'
          : !isExpanded
          ? 'translate-y-44 lg:translate-y-0'
          : 'translate-y-0'
      "
      data-cursor-black
    >
      <div
        class="
          lg:w-1/4
          h-16
          lg:h-full
          flex
          items-center
          justify-between
          px-6
          lg:px-0
        "
        @click="expandPlayer"
      >
        <!-- Podcast infos -->
        <div class="w-2/3 lg:w-full flex items-center">
          <NuxtLink
            v-if="href"
            class="inline-block"
            :class="!isExpanded && 'pointer-events-none md:pointer-events-auto'"
            :to="href"
            data-cursor-hover
          >
            <h3 class="text-sm lg:text-base text-black font-black">
              {{ typeAndNumber }}
            </h3>
            <p
              class="
                text-sm text-black
                font-light
                whitespace-nowrap
                overflow-hidden overflow-ellipsis
                mt-px
              "
            >
              {{ title }}
            </p>
          </NuxtLink>
        </div>

        <div class="relative lg:hidden">
          <!-- Like, play and stop icon -->
          <div
            class="flex space-x-5 transition-opacity"
            :class="
              isExpanded
                ? 'opacity-0 pointer-events-none'
                : 'opacity-100 duration-500 delay-200'
            "
          >
            <button
              class="h-6 text-pink"
              type="button"
              data-cursor-hover
              @click.stop=""
              v-html="require('../assets/icons/heart.svg?raw')"
            />
            <div class="w-5 h-6 flex justify-center">
              <button
                v-if="podcastPlayer.paused"
                class="h-full"
                type="button"
                data-cursor-hover
                @click.stop="podcastPlayer.play"
                v-html="require('../assets/icons/play.svg?raw')"
              />
              <button
                v-else
                class="h-full"
                type="button"
                data-cursor-hover
                @click.stop="podcastPlayer.pause"
                v-html="require('../assets/icons/pause.svg?raw')"
              />
            </div>
          </div>

          <!-- Collapse icon -->
          <button
            class="h-5 absolute top-px right-0 transition-opacity"
            :class="
              isExpanded
                ? 'opacity-100  duration-500 delay-200'
                : 'opacity-0 pointer-events-none'
            "
            type="button"
            data-cursor-hover
            @click.stop="collapsePlayer"
            v-html="require('../assets/icons/angle-down.svg?raw')"
          />
        </div>
      </div>

      <div
        class="lg:w-3/4 flex flex-col lg:flex-row lg:items-center lg:space-x-16"
      >
        <!-- Backword, play, pause and forward icon -->
        <div
          class="h-24 flex items-center justify-center space-x-12 lg:space-x-8"
        >
          <button
            class="h-9 lg:h-7"
            type="button"
            data-cursor-hover
            @click="podcastPlayer.backward"
            v-html="require('../assets/icons/15-sec-backwards.svg?raw')"
          />
          <div class="w-6 lg:w-5 flex justify-center">
            <button
              v-if="podcastPlayer.paused"
              class="h-9 lg:h-7"
              type="button"
              data-cursor-hover
              @click="podcastPlayer.play"
              v-html="require('../assets/icons/play.svg?raw')"
            />
            <button
              v-else
              class="h-9 lg:h-7"
              type="button"
              data-cursor-hover
              @click="podcastPlayer.pause"
              v-html="require('../assets/icons/pause.svg?raw')"
            />
          </div>
          <button
            class="h-9 lg:h-7"
            type="button"
            data-cursor-hover
            @click="podcastPlayer.forward"
            v-html="require('../assets/icons/15-sec-forwards.svg?raw')"
          />
        </div>

        <!-- Timeline and timestamps -->
        <div
          class="
            flex flex-wrap
            lg:flex-nowrap lg:flex-grow lg:items-center
            justify-between
            order-first
            lg:order-none lg:space-x-4
          "
        >
          <div class="text-sm lg:text-base mt-3 lg:mt-0.5 ml-6 lg:ml-0">
            {{ currentTimeString }}
          </div>
          <input
            v-model="podcastPlayer.currentTime"
            class="
              current-time-input
              w-full
              lg:w-auto lg:h-8
              order-first
              lg:order-none
            "
            type="range"
            min="0"
            :max="podcastPlayer.duration"
            step="1"
            :style="`--progress-percentage: ${progressString}`"
            data-cursor-hover
            @change="changeCurrentTime"
          />
          <div class="text-sm lg:text-base mt-3 lg:mt-0.5 mr-6 lg:mr-0">
            {{ durationString }}
          </div>
        </div>

        <!-- Volumeslider -->
        <div class="w-32 hidden lg:flex items-center space-x-4">
          <img
            class="h-6"
            :src="require('~/assets/icons/sound.svg')"
            alt="Sound"
          />
          <input
            v-model="podcastPlayer.volume"
            class="volume-input h-8"
            type="range"
            min="0"
            max="1"
            step="0.01"
            :style="`--progress-percentage: ${volumeString}`"
            data-cursor-hover
          />
        </div>

        <!-- Share and download -->
        <div
          class="
            flex flex-row-reverse
            lg:flex-row
            justify-between
            lg:space-x-8
            px-6
            py-3
            lg:p-0
          "
        >
          <button
            class="h-6 text-pink"
            type="button"
            data-cursor-hover
            v-html="require('../assets/icons/heart.svg?raw')"
          />
          <div class="flex space-x-8">
            <button
              v-if="clipboard.isSupported || share.isSupported"
              class="h-6"
              type="button"
              data-cursor-hover
              @click="sharePodcast"
              v-html="require('../assets/icons/share.svg?raw')"
            />
            <button
              class="w-6 h-6 flex justify-center"
              :class="isDownloading && 'animate-spin'"
              type="button"
              data-cursor-hover
              @click="downloadPodcast"
              v-html="
                require(isDownloading
                  ? '../assets/icons/semicircle.svg?raw'
                  : '../assets/icons/download.svg?raw')
              "
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from '@nuxtjs/composition-api';
import { usePodcastPlayer, useClipboard, useShare } from '../composables';
import {
  getFullPodcastTitle,
  getPodcastTypeAndNumber,
  getSubpagePath,
  downloadExternalFile,
  getUrlSlug,
} from '../helpers';

export default defineComponent({
  setup() {
    // Use podcast player, clipboard and share
    const podcastPlayer = usePodcastPlayer();
    const clipboard = useClipboard();
    const share = useShare();

    // Create is expanded and downloading reference
    const isExpanded = ref(false);
    const isDownloading = ref(false);

    // Create podcast type and number
    const typeAndNumber = computed(
      () =>
        podcastPlayer.podcast && getPodcastTypeAndNumber(podcastPlayer.podcast)
    );

    // Create podcast title
    const title = computed(() => podcastPlayer.podcast?.title);

    // Create full podcast title
    const fullTitle = computed(
      () => podcastPlayer.podcast && getFullPodcastTitle(podcastPlayer.podcast)
    );

    // Create href to podcast subpage
    const href = computed(
      () =>
        fullTitle.value &&
        podcastPlayer.podcast?.id &&
        getSubpagePath('podcast', fullTitle.value, podcastPlayer.podcast.id)
    );

    /**
     * It returns an audio timestamp based on a time value in seconds.
     *
     * @param time The time in seconds.
     *
     * @returns A audio timestamp.
     */
    const getAudioTimestamp = (time: number) => {
      const isoString = new Date(time * 1000).toISOString();
      return time < 3600 ? isoString.substr(14, 5) : isoString.substr(11, 8);
    };

    // Create current time string
    const currentTimeString = computed(() =>
      getAudioTimestamp(podcastPlayer.currentTime)
    );

    // Create duration string
    const durationString = computed(() =>
      getAudioTimestamp(podcastPlayer.duration)
    );

    // Create progress string
    const progressString = computed(
      () => `${(podcastPlayer.currentTime / podcastPlayer.duration) * 100}%`
    );

    // Create volume string
    const volumeString = computed(() => `${podcastPlayer.volume * 100}%`);

    /**
     * It expands the podcast player on mobile devices.
     */
    const expandPlayer = () => {
      if (window.innerWidth <= 768) {
        isExpanded.value = true;
      }
    };

    /**
     * It collapses the podcast player.
     */
    const collapsePlayer = () => {
      isExpanded.value = false;
    };

    /**
     * It changes the current time of the podcast player.
     */
    const changeCurrentTime = (event: Event) => {
      podcastPlayer.setCurrentTime(
        parseInt((event.target as HTMLInputElement).value)
      );
    };

    /**
     * It shares or copies the URL of the podcast
     * subpage via the share or clipboard API.
     */
    const sharePodcast = () => {
      if (podcastPlayer.podcast && fullTitle.value) {
        const url = `${window.location.origin}${href.value}`;
        if (share.isSupported) {
          share.share({
            title: 'programmier.bar',
            text: fullTitle.value,
            url,
          });
        } else if (clipboard.isSupported) {
          clipboard.copy(url);
        }
      }
    };

    // TODO: Show success message (e.g. a tooltip or toast)
    watch(
      () => clipboard.copied,
      () => {
        if (clipboard.copied) {
          // Add code here
        }
      }
    );

    /**
     * It downloads the audio file of a podcast episode.
     */
    const downloadPodcast = async () => {
      if (podcastPlayer.podcast && fullTitle.value) {
        // Start downloading
        isDownloading.value = true;

        // Download file
        await downloadExternalFile(
          podcastPlayer.podcast.audio_file.url,
          getUrlSlug(fullTitle.value)
        );

        // Stop downloading
        isDownloading.value = false;
      }
    };

    return {
      isExpanded,
      isDownloading,
      expandPlayer,
      collapsePlayer,
      podcastPlayer,
      href,
      typeAndNumber,
      title,
      currentTimeString,
      durationString,
      progressString,
      volumeString,
      share,
      clipboard,
      changeCurrentTime,
      sharePodcast,
      downloadPodcast,
    };
  },
});
</script>

<style lang="postcss">
.current-time-input::-webkit-slider-thumb {
  @apply w-4 h-4 bg-transparent -mt-1.5;
}
.current-time-input::-moz-range-thumb {
  @apply w-4 h-4 bg-transparent -mt-1.5;
}
.current-time-input::-webkit-slider-runnable-track {
  --progress-color: theme('colors.pink.500');
  --track-color: theme('colors.black');
  @apply h-1.25;
}
.current-time-input::-moz-range-progress {
  @apply h-1.25 bg-pink;
}
.current-time-input::-moz-range-track {
  @apply h-1.25 bg-black;
}
@media (min-width: 768px) {
  .current-time-input::-webkit-slider-runnable-track {
    @apply h-1.5;
  }
  .current-time-input::-moz-range-progress {
    @apply h-1.5;
  }
  .current-time-input::-moz-range-track {
    @apply h-1.5;
  }
}

.volume-input::-webkit-slider-thumb {
  @apply w-3 h-3 bg-blue -mt-1;
}
.volume-input::-moz-range-thumb {
  @apply w-3 h-3 bg-blue -mt-1;
}
.volume-input::-webkit-slider-runnable-track {
  --progress-color: theme('colors.blue.500');
  --track-color: theme('colors.black');
  @apply h-1;
}
.volume-input::-moz-range-progress {
  @apply h-1 bg-blue;
}
.volume-input::-moz-range-track {
  @apply h-1 bg-black;
}
</style>
