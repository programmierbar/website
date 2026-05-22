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

// Keep the active source's volume in sync with the slider.
watch(
    () => audioState.volume,
    (value) => {
        activeSource.value?.setVolume(value)
    }
)

const callbacks: SourceCallbacks = {
    onTimeUpdate: (time) => {
        // The scrub bar binds to audioState.currentTime via v-model, so it changes
        // ahead of the actual source while the user is dragging. The 5-second guard
        // prevents in-flight time updates from snapping the slider back to the
        // pre-seek position.
        if (Math.abs(time - audioState.currentTime) < 5) {
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
     * Seeks the currently active media source to the given time.
     */
    const setCurrentTime = (time: number) => {
        if (!activeSource.value) return
        activeSource.value.seek(time)
        audioState.currentTime = time
    }

    const backward = () => setCurrentTime(Math.max(audioState.currentTime - 15, 0))

    const forward = () => setCurrentTime(Math.min(audioState.currentTime + 15, audioState.duration))

    /**
     * Sets the given podcast as the current one. By default the bar binds to the
     * global HTMLAudioElement and streams `audio_url`. A `sourceFactory` may be
     * passed to bind the bar to a different playback backend (e.g. a YouTube
     * IFrame player) — in that case the audio element is not used.
     */
    const setPodcast = (
        nextPodcast: PodcastBasics,
        options?: { sourceFactory?: PodcastPlayerSourceFactory }
    ) => {
        if (!audioElement.value) return

        detachActiveSource()

        podcast.value = nextPodcast
        audioState.currentTime = 0
        audioState.duration = 1
        audioState.paused = true

        if (options?.sourceFactory) {
            activeSource.value = options.sourceFactory(callbacks)
        } else {
            audioElement.value.src = nextPodcast.audio_url
            activeSource.value = createAudioElementSource(audioElement.value, callbacks)
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
        const needsLoad = !audio.src || !audio.src.endsWith(targetPodcast.audio_url)
        if (needsLoad) {
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
            if (options.autoplay) {
                source.play()
                audioState.paused = false
            }
        }

        if (audio.readyState >= 1 /* HAVE_METADATA */) {
            applySeek()
        } else {
            audio.addEventListener('loadedmetadata', applySeek, { once: true })
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
        backward,
        forward,
        setPodcast,
        switchToAudioElement,
    })
}
