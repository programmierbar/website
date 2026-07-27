import { onMounted, reactive, ref, toRefs, watch } from 'vue'
import { PAUSE_PODCAST_EVENT_ID, PLAY_PODCAST_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'
import type { PodcastItem } from '../types'
import {
    createAudioElementSource,
    type MediaSource,
    type SourceCallbacks,
} from './useMediaSource'

type PodcastBasics = Pick<PodcastItem, 'id' | 'slug' | 'type' | 'number' | 'title' | 'audio_url'>

export type PodcastPlayerSourceFactory = (callbacks: SourceCallbacks) => MediaSource

const podcast = ref<PodcastBasics>()
const audioElement = ref<HTMLAudioElement>()
const activeSource = ref<MediaSource | null>(null)
const audioState = reactive({
    volume: 1,
    currentTime: 0,
    duration: 1,
    paused: true,
})

// True while the user is dragging the bar's scrub slider. While true, incoming
// time updates from the active source are suppressed so the slider thumb
// doesn't snap back to the pre-drag position. Cleared on `setCurrentTime`,
// which is called from the slider's @change handler (and from the 15s skip
// buttons, which is also fine).
let isScrubbing = false

// Keep the active source's volume in sync with the slider.
watch(
    () => audioState.volume,
    (value) => {
        activeSource.value?.setVolume(value)
    }
)

const callbacks: SourceCallbacks = {
    onTimeUpdate: (time) => {
        if (!isScrubbing) {
            audioState.currentTime = time
        }
    },
    onDurationChange: (duration) => {
        audioState.duration = duration || 1
    },
    onPlay: () => {
        audioState.paused = false
    },
    onPause: () => {
        audioState.paused = true
    },
    onEnded: () => {
        audioState.paused = true
    },
}

function detachActiveSource() {
    if (activeSource.value) {
        try {
            activeSource.value.pause()
        } catch {
            /* ignore — pausing a torn-down source is best-effort */
        }
        activeSource.value.destroy()
        activeSource.value = null
    }
}

/**
 * Composable that provide the functionality of the podcast player.
 *
 * @returns State and methods to use the podcast player.
 */
export function usePodcastPlayer() {
    /**
     * Plays the currently active media source.
     */
    const play = () => {
        if (!activeSource.value) return
        activeSource.value.play()
        audioState.paused = false
        trackGoal(PLAY_PODCAST_EVENT_ID)
    }

    /**
     * Pauses the currently active media source.
     */
    const pause = () => {
        if (!activeSource.value) return
        activeSource.value.pause()
        audioState.paused = true
        trackGoal(PAUSE_PODCAST_EVENT_ID)
    }

    /**
     * Seeks the currently active media source to the given time. Also clears
     * the scrubbing flag — any committed seek ends a drag.
     */
    const setCurrentTime = (time: number) => {
        isScrubbing = false
        if (!activeSource.value) return
        activeSource.value.seek(time)
        audioState.currentTime = time
    }

    /**
     * Called by the bar UI when the user starts dragging the scrub slider, so
     * that source-driven time updates don't fight the drag.
     */
    const beginScrubbing = () => {
        isScrubbing = true
    }

    /**
     * Returns whether the given podcast is the one currently loaded in the
     * player and actively playing (i.e. not paused). Matches by id, so any
     * object carrying the podcast id works. Useful for toggling a play/pause
     * affordance on episode cards and reference blocks.
     */
    const isPlaying = (podcastToCheck: Pick<PodcastItem, 'id'>) =>
        !audioState.paused && podcast.value?.id === podcastToCheck.id

    const backward = () => setCurrentTime(Math.max(audioState.currentTime - 15, 0))

    const forward = () => setCurrentTime(Math.min(audioState.currentTime + 15, audioState.duration))

    /**
     * Sets the given podcast as the current one. By default the bar binds to the
     * global HTMLAudioElement and streams `audio_url`. A `sourceFactory` may be
     * passed to bind the bar to a different playback backend (e.g. a YouTube
     * IFrame player) — in that case the audio element is not used.
     *
     * `startAt` (seconds) begins the episode at an offset — e.g. jumping to the
     * point a news item is discussed. For the audio element the seek is applied
     * once metadata is available (setting `currentTime` before then is reset to
     * 0 by the browser), guarded so a quick episode switch doesn't seek the
     * wrong source.
     */
    const setPodcast = (
        nextPodcast: PodcastBasics,
        options?: { sourceFactory?: PodcastPlayerSourceFactory; startAt?: number }
    ) => {
        if (!audioElement.value) return

        detachActiveSource()

        podcast.value = nextPodcast
        audioState.currentTime = 0
        audioState.duration = 1
        audioState.paused = true

        const startAt = options?.startAt && options.startAt > 0 ? options.startAt : 0

        if (options?.sourceFactory) {
            const source = options.sourceFactory(callbacks)
            activeSource.value = source
            if (startAt) {
                // Non-audio-element backends (e.g. YouTube) accept a seek before
                // playback, so apply it directly.
                source.seek(startAt)
                audioState.currentTime = startAt
            }
        } else {
            const audio = audioElement.value
            audio.src = nextPodcast.audio_url
            const source = createAudioElementSource(audio, callbacks)
            activeSource.value = source

            if (startAt) {
                const applySeek = () => {
                    // Bail if the user switched episodes before metadata loaded,
                    // so we don't seek the wrong source.
                    if (activeSource.value !== source) return
                    try {
                        audio.currentTime = startAt
                    } catch {
                        /* duration may not be known yet on some browsers; ignore */
                    }
                    audioState.currentTime = startAt
                }

                if (audio.readyState >= 1 /* HAVE_METADATA */) {
                    applySeek()
                } else {
                    audio.addEventListener('loadedmetadata', applySeek, { once: true })
                }
            }
        }

        activeSource.value.setVolume(audioState.volume)
    }

    /**
     * Detaches the current (non-audio-element) source and reattaches the global
     * HTMLAudioElement at `seekTime`. Used by EmbeddedVideoPlayer to hand off
     * playback to the audio bar when the video iframe unmounts (e.g. on page
     * navigation). If `autoplay` is true, playback resumes once the audio
     * element has loaded enough to seek.
     *
     * NOTE: YouTube cuts and Buzzsprout audio may differ slightly in length
     * (intros, ads, edits), so the handoff timestamp can be off by a few
     * seconds.
     */
    const switchToAudioElement = (options: { seekTime: number; autoplay: boolean }) => {
        if (!audioElement.value || !podcast.value) return

        detachActiveSource()

        const audio = audioElement.value
        const targetPodcast = podcast.value

        // Mirror the bar's normal `setPodcast`: assign src only when it
        // actually changes, and otherwise leave the element alone. Extra
        // teardown ops here (pause/removeAttribute/load) interact badly with
        // the Buzzsprout CDN during unmount.
        if (audio.src !== targetPodcast.audio_url) {
            audio.src = targetPodcast.audio_url
        }

        const source = createAudioElementSource(audio, callbacks)
        activeSource.value = source
        source.setVolume(audioState.volume)

        const applySeek = () => {
            try {
                audio.currentTime = options.seekTime
            } catch {
                /* duration may not be known yet on some browsers; ignore */
            }
            audioState.currentTime = options.seekTime
        }

        if (audio.readyState >= 1 /* HAVE_METADATA */) {
            applySeek()
        } else {
            audio.addEventListener('loadedmetadata', applySeek, { once: true })
        }

        if (options.autoplay) {
            const startPlayback = () => source.play()
            if (audio.readyState >= 3 /* HAVE_FUTURE_DATA */) {
                startPlayback()
            } else {
                audio.addEventListener('canplay', startPlayback, { once: true })
            }
        }
    }

    // Create the global audio element the first time any consumer of the
    // composable mounts. The element lives outside the DOM — the bar reads its
    // state via the source adapter.
    onMounted(() => {
        if (!audioElement.value) {
            audioElement.value = document.createElement('audio')
            // TODO: Fix TypeScript build error
            // navigator.mediaSession?.setActionHandler('play', () => {
            //   play();
            // });
            // navigator.mediaSession?.setActionHandler('pause', () => {
            //   pause();
            // });
        }
    })

    return reactive({
        podcast,
        ...toRefs(audioState),
        play,
        pause,
        setCurrentTime,
        beginScrubbing,
        isPlaying,
        backward,
        forward,
        setPodcast,
        switchToAudioElement,
    })
}
