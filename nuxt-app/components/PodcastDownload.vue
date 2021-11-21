<template>
  <button
    class="
      relative
      flex
      items-center
      justify-center
      border-lime border-3
      md:border-4
      rounded-full
      text-sm
      md:text-base
      lg:text-lg
      text-lime
      font-black
      tracking-widest
      uppercase
      px-4
      md:px-8
      py-0.5
    "
    type="button"
    data-cursor-hover
    @click="downloadAudioFile"
  >
    <span
      class="pt-0.5 transition-opacity duration-300"
      :class="isLoading && 'opacity-0'"
    >
      Download
    </span>
    <span
      class="
        h-4
        md:h-5
        absolute
        animate-spin
        text-lime
        transition-opacity
        duration-300
      "
      :class="!isLoading && 'opacity-0'"
      v-html="require('../assets/icons/semicircle.svg?raw')"
    >
    </span>
  </button>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from '@nuxtjs/composition-api';
import { StrapiPodcast } from 'shared-code';
import {
  downloadExternalFile,
  getUrlSlug,
  getFullPodcastTitle,
  trackGoal,
} from '../helpers';

export default defineComponent({
  props: {
    podcast: {
      type: Object as PropType<StrapiPodcast>,
      required: true,
    },
  },
  setup(props) {
    // Create is loading reference
    const isLoading = ref(false);

    /**
     * It downloads the audio file of a podcast episode.
     */
    const downloadAudioFile = async () => {
      // Start loading
      isLoading.value = true;

      // Download file
      await downloadExternalFile(
        props.podcast.audio_file.url,
        getUrlSlug(getFullPodcastTitle(props.podcast))
      );

      // Track analytic event
      trackGoal(process.env.NUXT_ENV_DOWNLOAD_PODCAST_EVENT!);

      // Stop loading
      isLoading.value = false;
    };

    return {
      isLoading,
      downloadAudioFile,
    };
  },
});
</script>
