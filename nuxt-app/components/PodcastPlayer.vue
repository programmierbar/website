<template>
  <div
    class="transition-all"
    :class="podcastPlayer.podcast ? 'h-16 xl:h-20' : 'h-0 invisible'"
  >
    <div
      class="w-full xl:h-20 fixed z-40 left-0 bottom-0 flex flex-col xl:flex-row bg-lime transition-transform duration-300 xl:space-x-16 xl:px-8"
      :class="
        !podcastPlayer.podcast
          ? 'translate-y-full'
          : !isExpanded
          ? 'translate-y-[11.15rem] xl:translate-y-0'
          : 'translate-y-0'
      "
      data-cursor-black
    >
      <div
        class="xl:w-1/4 h-14 xl:h-full flex items-center justify-between px-6 xl:px-0 pt-2.5 xl:pt-0"
        @click="expandPlayer"
      >
        <!-- Podcast infos -->
        <div class="w-2/3 xl:w-full flex items-center">
          <NuxtLink
            v-if="href"
            class="w-full inline-block"
            :class="!isExpanded && 'pointer-events-none xl:pointer-events-auto'"
            :to="href"
            data-cursor-hover
          >
            <h3
              class="text-sm xl:text-base text-black font-black whitespace-nowrap overflow-hidden overflow-ellipsis"
            >
              {{ typeAndNumber }}
            </h3>
            <p
              class="text-sm text-black font-light whitespace-nowrap overflow-hidden overflow-ellipsis mt-px"
            >
              {{ title }}
            </p>
          </NuxtLink>
        </div>

        <div class="h-8 relative xl:hidden">
          <!-- Like, play and stop icon -->
          <div
            class="h-full flex space-x-5 transition-opacity"
            :class="
              isExpanded
                ? 'invisible opacity-0 pointer-events-none'
                : 'duration-500 delay-200'
            "
            :style="
              isExpanded
                ? 'transition: visibility 0s .15s, opacity .15s'
                : undefined
            "
          >
            <!-- <button
              class="h-6 text-pink"
              type="button"
              data-cursor-hover
              @click.stop=""
              v-html="require('../assets/icons/heart.svg?raw')"
            /> -->
            <div class="w-8 h-full flex justify-center">
              <button
                v-if="podcastPlayer.paused"
                class="h-full p-1.25"
                type="button"
                data-cursor-hover
                @click.stop="podcastPlayer.play"
                v-html="playIcon"
              />
              <button
                v-else
                class="h-full p-1.25"
                type="button"
                data-cursor-hover
                @click.stop="podcastPlayer.pause"
                v-html="pauseIcon"
              />
            </div>
          </div>

          <!-- Collapse icon -->
          <button
            class="h-full absolute top-px right-0 transition-opacity p-1.5"
            :class="
              isExpanded
                ? 'duration-500 delay-200'
                : 'invisible opacity-0 pointer-events-none'
            "
            :style="
              !isExpanded
                ? 'transition: visibility 0s .15s, opacity .15s'
                : undefined
            "
            type="button"
            data-cursor-hover
            @click.stop="collapsePlayer"
            v-html="angleDownIcon"
          />
        </div>
      </div>

      <div
        class="xl:w-3/4 flex flex-col xl:flex-row xl:items-center xl:space-x-16"
      >
        <!-- Backword, play, pause and forward icon -->
        <div
          class="h-24 flex items-center justify-center space-x-12 xl:space-x-8"
          :class="!isExpanded && 'invisible xl:visible'"
          :style="!isExpanded ? 'transition: visibility 0s 0.3s' : undefined"
        >
          <button
            class="h-9 xl:h-7"
            type="button"
            data-cursor-hover
            @click="podcastPlayer.backward"
            v-html="fifteenSecBackwardsIcon"
          />
          <div class="w-6 xl:w-5 flex justify-center">
            <button
              v-if="podcastPlayer.paused"
              class="h-9 xl:h-7"
              type="button"
              data-cursor-hover
              @click="podcastPlayer.play"
              v-html="playIcon"
            />
            <button
              v-else
              class="h-9 xl:h-7"
              type="button"
              data-cursor-hover
              @click="podcastPlayer.pause"
              v-html="pauseIcon"
            />
          </div>
          <button
            class="h-9 xl:h-7"
            type="button"
            data-cursor-hover
            @click="podcastPlayer.forward"
            v-html="fifteenSecForwardsIcon"
          />
        </div>

        <!-- Timeline and timestamps -->
        <div
          class="flex flex-wrap xl:flex-nowrap xl:flex-grow xl:items-center justify-between order-first xl:order-none xl:space-x-4"
        >
          <div class="text-sm xl:text-base m-0.5 ml-6 xl:ml-0">
            {{ currentTimeString }}
          </div>
          <input
            v-model="podcastPlayer.currentTime"
            class="current-time-input w-full h-6 xl:w-auto xl:h-8 order-first xl:order-none"
            type="range"
            min="0"
            :max="podcastPlayer.duration"
            step="1"
            :style="`--progress-percentage: ${progressString}`"
            data-cursor-hover
            @change="changeCurrentTime"
          />
          <div class="text-sm xl:text-base mt-0.5 mr-6 xl:mr-0">
            {{ durationString }}
          </div>
        </div>

        <!-- Volumeslider -->
        <div class="w-32 hidden xl:flex items-center space-x-4">
          <div class="h-6" v-html="soundIcon" alt="Sound" />
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
          class="flex flex-row-reverse xl:flex-row justify-between xl:space-x-8 px-6 py-3 xl:p-0"
          :class="!isExpanded && 'invisible xl:visible'"
          :style="!isExpanded ? 'transition: visibility 0s 0.3s' : undefined"
        >
          <!-- <button
            class="h-6 text-pink"
            type="button"
            data-cursor-hover
            v-html="require('../assets/icons/heart.svg?raw')"
          /> -->
          <div class="flex space-x-8">
            <button
              v-if="clipboard.isSupported || share.isSupported"
              class="h-6"
              type="button"
              data-cursor-hover
              @click="sharePodcast"
              v-html="shareIcon"
            />
            <a
              class="w-6 h-6 flex justify-center"
              :href="downloadUrl"
              download
              data-cursor-hover
              @click="() => trackGoal(DOWNLOAD_PODCAST_EVENT_ID)"
              v-html="downloadIcon"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import playIcon from '~/assets/icons/play.svg?raw';
import pauseIcon from '~/assets/icons/pause.svg?raw';
import angleDownIcon from '~/assets/icons/angle-down.svg?raw';
import fifteenSecBackwardsIcon from '~/assets/icons/15-sec-backwards.svg?raw';
import fifteenSecForwardsIcon from '~/assets/icons/15-sec-forwards.svg?raw';
import soundIcon from '~/assets/icons/sound.svg?raw';
import shareIcon from '~/assets/icons/share.svg?raw';
import downloadIcon from '~/assets/icons/download.svg?raw';
import { computed, ref, watch } from 'vue';
import { getFullPodcastTitle, getPodcastTypeAndNumber } from 'shared-code';
import { BUZZSPROUT_TRACKING_URL, DOWNLOAD_PODCAST_EVENT_ID } from '../config';
import { usePodcastPlayer, useClipboard, useShare } from '../composables';
import { trackGoal } from '../helpers';
// Use podcast player, clipboard and share
const podcastPlayer = usePodcastPlayer();
const clipboard = useClipboard();
const share = useShare();

// Create is expanded reference
const isExpanded = ref(false);

// Create podcast type and number
const typeAndNumber = computed(
  () => podcastPlayer.podcast && getPodcastTypeAndNumber(podcastPlayer.podcast)
);

// Create podcast title
const title = computed(() => podcastPlayer.podcast?.title);

// Create full podcast title
const fullTitle = computed(
  () => podcastPlayer.podcast && getFullPodcastTitle(podcastPlayer.podcast)
);

// Create href to podcast subpage
const href = computed(
  () => podcastPlayer.podcast && `/podcast/${podcastPlayer.podcast.slug}`
);

// Create download URL
const downloadUrl = computed(
  () =>
    podcastPlayer.podcast &&
    `${BUZZSPROUT_TRACKING_URL}/${podcastPlayer.podcast.audio_url}?download=true`
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
  if (window.innerWidth < 1280) {
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
</script>

<style lang="postcss" scoped>
.current-time-input::-webkit-slider-thumb {
  @apply w-4 h-4 bg-transparent -mt-1.5;
}
.current-time-input::-moz-range-thumb {
  @apply w-4 h-4 bg-transparent -mt-1.5;
}
.current-time-input::-webkit-slider-runnable-track {
  --progress-color: theme('colors.pink.500');
  --track-color: theme('colors.black');
  @apply h-1.25 rounded-none;
}
.current-time-input::-moz-range-progress {
  @apply h-1.25 bg-pink rounded-none;
}
.current-time-input::-moz-range-track {
  @apply h-1.25 bg-black rounded-none;
}
@media (min-width: 1280px) {
  .current-time-input::-webkit-slider-runnable-track {
    @apply h-1.5 rounded;
  }
  .current-time-input::-moz-range-progress {
    @apply h-1.5 rounded;
  }
  .current-time-input::-moz-range-track {
    @apply h-1.5 rounded;
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
