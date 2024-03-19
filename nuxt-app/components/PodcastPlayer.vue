<template>
    <div class="transition-all" :class="podcastPlayer.podcast ? 'h-16 xl:h-20' : 'invisible h-0'">
        <div
            class="fixed bottom-0 left-0 z-40 flex w-full flex-col bg-lime transition-transform duration-300 xl:h-20 xl:flex-row xl:space-x-16 xl:px-8"
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
                class="flex h-14 items-center justify-between px-6 pt-2.5 xl:h-full xl:w-1/4 xl:px-0 xl:pt-0"
                @click="expandPlayer"
            >
                <!-- Podcast infos -->
                <div class="flex w-2/3 items-center xl:w-full">
                    <NuxtLink
                        v-if="href"
                        class="inline-block w-full"
                        :class="!isExpanded && 'pointer-events-none xl:pointer-events-auto'"
                        :to="href"
                        data-cursor-hover
                    >
                        <h3
                            class="overflow-hidden overflow-ellipsis whitespace-nowrap text-sm font-black text-black xl:text-base"
                        >
                            {{ typeAndNumber }}
                        </h3>
                        <p
                            class="mt-px overflow-hidden overflow-ellipsis whitespace-nowrap text-sm font-light text-black"
                        >
                            {{ title }}
                        </p>
                    </NuxtLink>
                </div>

                <div class="relative h-8 xl:hidden">
                    <!-- Like, play and stop icon -->
                    <div
                        class="flex h-full space-x-5 transition-opacity"
                        :class="isExpanded ? 'pointer-events-none invisible opacity-0' : 'delay-200 duration-500'"
                        :style="isExpanded ? 'transition: visibility 0s .15s, opacity .15s' : undefined"
                    >
                        <!-- <button
              class="h-6 text-pink"
              type="button"
              data-cursor-hover
              @click.stop=""
              v-html="require('../assets/icons/heart.svg?raw')"
            /> -->
                        <div class="flex h-full w-8 justify-center">
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
                        class="absolute right-0 top-px h-full p-1.5 transition-opacity"
                        :class="isExpanded ? 'delay-200 duration-500' : 'pointer-events-none invisible opacity-0'"
                        :style="!isExpanded ? 'transition: visibility 0s .15s, opacity .15s' : undefined"
                        type="button"
                        data-cursor-hover
                        @click.stop="collapsePlayer"
                        v-html="angleDownIcon"
                    />
                </div>
            </div>

            <div class="flex flex-col xl:w-3/4 xl:flex-row xl:items-center xl:space-x-16">
                <!-- Backword, play, pause and forward icon -->
                <div
                    class="flex h-24 items-center justify-center space-x-12 xl:space-x-8"
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
                    <div class="flex w-6 justify-center xl:w-5">
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
                    class="order-first flex flex-wrap justify-between xl:order-none xl:flex-grow xl:flex-nowrap xl:items-center xl:space-x-4"
                >
                    <div class="m-0.5 ml-6 text-sm xl:ml-0 xl:text-base">
                        {{ currentTimeString }}
                    </div>
                    <input
                        v-model="podcastPlayer.currentTime"
                        class="current-time-input order-first h-6 w-full xl:order-none xl:h-8 xl:w-auto"
                        type="range"
                        min="0"
                        :max="podcastPlayer.duration"
                        step="1"
                        :style="`--progress-percentage: ${progressString}`"
                        data-cursor-hover
                        @change="changeCurrentTime"
                    />
                    <div class="mr-6 mt-0.5 text-sm xl:mr-0 xl:text-base">
                        {{ durationString }}
                    </div>
                </div>

                <!-- Volumeslider -->
                <div class="hidden w-32 items-center space-x-4 xl:flex">
                    <div class="h-6" v-html="soundIcon" />
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
                    class="flex flex-row-reverse justify-between px-6 py-3 xl:flex-row xl:space-x-8 xl:p-0"
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
                            class="flex h-6 w-6 justify-center"
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
import fifteenSecBackwardsIcon from '~/assets/icons/15-sec-backwards.svg?raw'
import fifteenSecForwardsIcon from '~/assets/icons/15-sec-forwards.svg?raw'
import angleDownIcon from '~/assets/icons/angle-down.svg?raw'
import downloadIcon from '~/assets/icons/download.svg?raw'
import pauseIcon from '~/assets/icons/pause.svg?raw'
import playIcon from '~/assets/icons/play.svg?raw'
import shareIcon from '~/assets/icons/share.svg?raw'
import soundIcon from '~/assets/icons/sound.svg?raw'
import { getFullPodcastTitle, getPodcastTypeAndNumber } from 'shared-code'
import { computed, ref, watch } from 'vue'
import { useClipboard, usePodcastPlayer, useShare } from '../composables'
import { BUZZSPROUT_TRACKING_URL, DOWNLOAD_PODCAST_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'

// Use podcast player, clipboard and share
const podcastPlayer = usePodcastPlayer()
const clipboard = useClipboard()
const share = useShare()

// Create is expanded reference
const isExpanded = ref(false)

// Create podcast type and number
const typeAndNumber = computed(() => podcastPlayer.podcast && getPodcastTypeAndNumber(podcastPlayer.podcast))

// Create podcast title
const title = computed(() => podcastPlayer.podcast?.title)

// Create full podcast title
const fullTitle = computed(() => podcastPlayer.podcast && getFullPodcastTitle(podcastPlayer.podcast))

// Create href to podcast subpage
const href = computed(() => podcastPlayer.podcast && `/podcast/${podcastPlayer.podcast.slug}`)

// Create download URL
const downloadUrl = computed(
    () => podcastPlayer.podcast && `${BUZZSPROUT_TRACKING_URL}/${podcastPlayer.podcast.audio_url}?download=true`
)

/**
 * It returns an audio timestamp based on a time value in seconds.
 *
 * @param time The time in seconds.
 *
 * @returns A audio timestamp.
 */
const getAudioTimestamp = (time: number) => {
    const isoString = new Date(time * 1000).toISOString()
    return time < 3600 ? isoString.substr(14, 5) : isoString.substr(11, 8)
}

// Create current time string
const currentTimeString = computed(() => getAudioTimestamp(podcastPlayer.currentTime))

// Create duration string
const durationString = computed(() => getAudioTimestamp(podcastPlayer.duration))

// Create progress string
const progressString = computed(() => `${(podcastPlayer.currentTime / podcastPlayer.duration) * 100}%`)

// Create volume string
const volumeString = computed(() => `${podcastPlayer.volume * 100}%`)

/**
 * It expands the podcast player on mobile devices.
 */
const expandPlayer = () => {
    if (window.innerWidth < 1280) {
        isExpanded.value = true
    }
}

/**
 * It collapses the podcast player.
 */
const collapsePlayer = () => {
    isExpanded.value = false
}

/**
 * It changes the current time of the podcast player.
 */
const changeCurrentTime = (event: Event) => {
    podcastPlayer.setCurrentTime(parseInt((event.target as HTMLInputElement).value))
}

/**
 * It shares or copies the URL of the podcast
 * subpage via the share or clipboard API.
 */
const sharePodcast = () => {
    if (podcastPlayer.podcast && fullTitle.value) {
        const url = `${window.location.origin}${href.value}`
        if (share.isSupported) {
            share.share({
                title: 'programmier.bar',
                text: fullTitle.value,
                url,
            })
        } else if (clipboard.isSupported) {
            clipboard.copy(url)
        }
    }
}

// TODO: Show success message (e.g. a tooltip or toast)
watch(
    () => clipboard.copied,
    () => {
        if (clipboard.copied) {
            // Add code here
        }
    }
)
</script>

<style lang="postcss" scoped>
.current-time-input::-webkit-slider-thumb {
    @apply -mt-1.5 h-4 w-4 bg-transparent;
}
.current-time-input::-moz-range-thumb {
    @apply -mt-1.5 h-4 w-4 bg-transparent;
}
.current-time-input::-webkit-slider-runnable-track {
    --progress-color: theme('colors.pink.500');
    --track-color: theme('colors.black');
    @apply h-1.25 rounded-none;
}
.current-time-input::-moz-range-progress {
    @apply h-1.25 rounded-none bg-pink;
}
.current-time-input::-moz-range-track {
    @apply h-1.25 rounded-none bg-black;
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
    @apply -mt-1 h-3 w-3 bg-blue;
}
.volume-input::-moz-range-thumb {
    @apply -mt-1 h-3 w-3 bg-blue;
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
