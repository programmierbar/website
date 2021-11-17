<template>
  <div class="w-48 md:w-64 lg:w-96 relative">
    <NuxtLink :to="href" data-cursor-more>
      <!-- Podcast cover -->
      <img
        class="w-48 md:w-64 lg:w-96 h-48 md:h-64 lg:h-96 pointer-events-none"
        :src="podcast.cover_image.url"
        :srcset="coverSrcSet"
        sizes="(min-width: 1024px) 384px, (min-width: 768px) 256px, 192px"
        loading="lazy"
        :alt="podcast.cover_image.alternativeText || fullTitle"
      />
    </NuxtLink>

    <!-- Podcast date -->
    <div
      class="
        hidden
        md:block
        text-sm
        lg:text-base
        text-white
        font-light
        italic
        mt-4
      "
    >
      {{ date }}
    </div>

    <div class="flex space-x-4 mt-3 transition-all duration-500">
      <!-- Podcast play or pause button -->
      <button
        class="h-10 md:h-12 text-lime"
        type="button"
        data-cursor-hover
        @click="playOrPausePodcast"
        v-html="
          require(`../assets/icons/${
            podcastPlayer.podcast &&
            podcastPlayer.podcast.id === podcast.id &&
            !podcastPlayer.paused
              ? 'pause'
              : 'play'
          }-circle.svg?raw`)
        "
      />

      <div class="w-4/5">
        <!-- Podcast title -->
        <h2
          class="
            text-sm
            md:text-lg
            lg:text-xl
            text-white
            font-light
            line-clamp-2
          "
        >
          <strong v-if="podcast.type !== 'other'" class="font-black">
            {{ type }} {{ podcast.number }}{{ divider }}
          </strong>
          {{ podcast.title }}
        </h2>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiPodcast } from 'shared-code';
import { usePodcastPlayer } from '../composables';
import {
  getImageSrcSet,
  getPodcastTypeString,
  getPodcastTitleDivider,
  getFullPodcastTitle,
  getSubpagePath,
} from '../helpers';

export default defineComponent({
  props: {
    podcast: {
      type: Object as PropType<StrapiPodcast>,
      required: true,
    },
  },
  setup(props) {
    // Use podcast player
    const podcastPlayer = usePodcastPlayer();

    /**
     * It plays or pauses the podcast.
     */
    const playOrPausePodcast = () => {
      if (podcastPlayer.podcast?.id !== props.podcast.id) {
        podcastPlayer.setPodcast(props.podcast);
      }
      if (podcastPlayer.paused) {
        podcastPlayer.play();
      } else {
        podcastPlayer.pause();
      }
    };

    // Create local date string
    const date = computed(() =>
      new Date(props.podcast.published_at).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    );

    // Create cover src set
    const coverSrcSet = computed(() =>
      getImageSrcSet(props.podcast.cover_image)
    );

    // Create podcast type
    const type = computed(() => getPodcastTypeString(props.podcast));

    // Create divider between podcast type and title
    const divider = computed(() => getPodcastTitleDivider(props.podcast));

    // Create full podcast title
    const fullTitle = computed(() => getFullPodcastTitle(props.podcast));

    // Create href to podcast subpage
    const href = computed(() =>
      getSubpagePath('podcast', fullTitle.value, props.podcast.id)
    );

    return {
      podcastPlayer,
      playOrPausePodcast,
      date,
      coverSrcSet,
      type,
      divider,
      fullTitle,
      href,
    };
  },
});
</script>
