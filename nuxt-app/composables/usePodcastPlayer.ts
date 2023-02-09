import { ref, reactive, onMounted, watch, toRefs } from 'vue';
import { PAUSE_PODCAST_EVENT_ID, PLAY_PODCAST_EVENT_ID } from '../config';
import { trackGoal } from '../helpers';
import { PodcastItem } from '../types';

// Create global references
const podcast =
  ref<
    Pick<PodcastItem, 'id' | 'slug' | 'type' | 'number' | 'title' | 'audio_url'>
  >();
const audioElement = ref<HTMLAudioElement>();
const audioState = reactive({
  volume: 1,
  currentTime: 0,
  duration: 1,
  paused: true,
});

// Update volume of audio element when state changes
watch(
  () => audioState.volume,
  () => {
    if (audioElement.value) {
      audioElement.value.volume = audioState.volume;
    }
  }
);

/**
 * Composable that provide the functionality of the podcast player.
 *
 * @returns State and methods to use the podcast player.
 */
export function usePodcastPlayer() {
  /**
   * It plays the currently stored audio file.
   */
  const play = () => {
    if (audioElement.value) {
      audioElement.value.play();
      audioState.paused = false;
      trackGoal(PLAY_PODCAST_EVENT_ID);
    }
  };

  /**
   * It pauses the playback of the current audio file.
   */
  const pause = () => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioState.paused = true;
      trackGoal(PAUSE_PODCAST_EVENT_ID);
    }
  };

  /**
   * Sets the current time to a certain point in the audio file.
   *
   * @param volume The new current time.
   */
  const setCurrentTime = (time: number) => {
    if (audioElement.value) {
      audioElement.value.currentTime = time;
      audioState.currentTime = time;
    }
  };

  /**
   * It rewinds the audio file 15 seconds.
   */
  const backward = () =>
    setCurrentTime(Math.max(audioState.currentTime - 15, 0));

  /**
   * It fast-forwards the audio file 15 seconds.
   */
  const forward = () =>
    setCurrentTime(Math.min(audioState.currentTime + 15, audioState.duration));

  /**
   * It sets the give podcast as the current one.
   *
   * @param nextPodcast The next podcast.
   */
  const setPodcast = (
    nextPodcast: Pick<
      PodcastItem,
      'id' | 'slug' | 'type' | 'number' | 'title' | 'audio_url'
    >
  ) => {
    if (audioElement.value) {
      // Pause prevoius podcast if necessary
      if (!audioState.paused) {
        pause();
      }

      // Set next podcast
      podcast.value = nextPodcast;
      audioElement.value.src = nextPodcast.audio_url;

      // Update state when metadata has loaded
      audioElement.value.addEventListener('loadedmetadata', () => {
        audioState.currentTime = audioElement.value!.currentTime;
        audioState.duration = audioElement.value!.duration;
      });
    }
  };

  // Create audio element and add timeupdate event
  // listener to it on first mounted component
  onMounted(() => {
    if (!audioElement.value) {
      audioElement.value = document.createElement('audio');
      audioElement.value.addEventListener('timeupdate', () => {
        if (
          audioElement.value &&
          Math.abs(audioElement.value.currentTime - audioState.currentTime) < 5
        ) {
          audioState.currentTime = audioElement.value.currentTime;
        }
      });
      // TODO: Fix TypeScript build error
      // navigator.mediaSession?.setActionHandler('play', () => {
      //   play();
      // });
      // navigator.mediaSession?.setActionHandler('pause', () => {
      //   pause();
      // });
    }
  });

  return reactive({
    podcast,
    ...toRefs(audioState),
    play,
    pause,
    setCurrentTime,
    backward,
    forward,
    setPodcast,
  });
}
