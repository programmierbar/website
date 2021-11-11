<template>
  <div
    class="relative"
    :class="[
      podcast.type === 'deep_dive' && podcast.banner_image && 'md:bg-lime',
    ]"
    :data-cursor-black="
      !!(podcast.type === 'deep_dive' && podcast.banner_image)
    "
  >
    <!-- Overlay gradient top -->
    <div
      class="
        w-full
        h-32
        absolute
        -z-1
        left-0
        top-0
        bg-gradient-to-b
        to-transparent
        opacity-40
      "
      :class="[
        podcast.type === 'cto_special'
          ? 'from-blue'
          : podcast.type === 'news'
          ? 'from-pink'
          : 'from-lime',
        podcast.type === 'deep_dive' && podcast.banner_image && 'md:hidden',
      ]"
    />

    <!-- Overlay gradient bottom -->
    <div
      v-if="podcast.banner_image"
      class="
        w-full
        h-32
        absolute
        left-0
        bottom-0
        hidden
        md:block
        bg-gradient-to-t
        from-black
        to-transparent
      "
    />

    <!-- Main content -->
    <div
      class="
        container
        relative
        flex
        items-center
        space-x-6
        md:space-x-8
        3xl:space-x-12
        px-6
        md:px-8
        pt-28
        pb-8
        md:py-32
        lg:py-36
      "
    >
      <!-- Play or stop button -->
      <button
        class="h-20 md:h-32 lg:h-36 text-white"
        :class="
          podcast.type === 'deep_dive' &&
          podcast.banner_image &&
          'md:text-black'
        "
        data-cursor-hover
        type="button"
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

      <!-- Podcast episode info -->
      <div
        class="w-0 flex-grow"
        :class="podcast.banner_image && 'md:w-3/5 md:flex-grow-0'"
      >
        <div
          class="
            text-sm
            md:text-lg
            lg:text-xl
            font-black
            tracking-widest
            uppercase
          "
          :class="[
            podcast.type === 'deep_dive' && podcast.banner_image
              ? 'text-blue md:text-black'
              : podcast.type === 'cto_special'
              ? 'text-black'
              : podcast.type === 'deep_dive' || podcast.type === 'news'
              ? 'text-blue'
              : 'text-white',
            podcast.type === 'cto_special' &&
              'inline-block bg-lime px-2 pt-3 pb-2',
          ]"
        >
          {{ type }} {{ podcast.number }} –
        </div>
        <h1
          class="
            text-3xl
            md:text-5xl
            lg:text-6xl
            font-black
            leading-normal
            break-words
          "
          :class="[
            podcast.type === 'deep_dive'
              ? podcast.banner_image
                ? 'text-lime md:text-black'
                : 'text-lime'
              : podcast.type === 'cto_special'
              ? 'text-blue'
              : podcast.type === 'news'
              ? 'text-pink'
              : 'text-white',
            podcast.type === 'cto_special'
              ? 'mt-5 md:mt-7 lg:mt-9'
              : 'mt-3 md:mt-5 lg:mt-7',
          ]"
        >
          {{ podcast.title }}
        </h1>
        <div
          class="
            text-sm
            md:text-lg
            text-white
            font-light
            italic
            mt-2
            md:mt-4
            lg:mt-6
          "
          :class="
            podcast.type === 'deep_dive' &&
            podcast.banner_image &&
            'md:text-black'
          "
        >
          {{ date }}
        </div>
      </div>

      <!-- Speaker banner image -->
      <FadeAnimation
        v-if="podcast.banner_image"
        class="
          w-52
          md:w-96
          lg:w-112
          h-52
          md:h-96
          lg:h-112
          absolute
          right-0
          bottom-0
          hidden
          md:block
        "
        :class="podcast.type === 'deep_dive' ? 'mix-blend-multiply' : '-z-1'"
        fade-in="normal"
        fade-out="none"
        :duration="500"
      >
        <img
          class="w-full h-full object-cover opacity-90"
          :src="podcast.banner_image.url"
          :srcset="bannerSrcSet"
          sizes="(min-width: 768px) 400px, 200px"
          :alt="podcast.banner_image.alternativeText || speakerName"
        />
      </FadeAnimation>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiPodcast } from 'shared-code';
import { usePodcastPlayer } from '../composables';
import {
  getPodcastTypeString,
  getImageSrcSet,
  getFullSpeakerName,
} from '../helpers';
import FadeAnimation from './FadeAnimation.vue';

export default defineComponent({
  components: {
    FadeAnimation,
  },
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
      new Date(props.podcast.published_at).toLocaleDateString()
    );

    // Create podcast type
    const type = computed(() => getPodcastTypeString(props.podcast));

    // Create banner src set
    const bannerSrcSet = computed(() =>
      props.podcast.banner_image
        ? getImageSrcSet(props.podcast.banner_image)
        : undefined
    );

    // Create speaker name
    const speakerName = computed(() => {
      const firstSpeaker = props.podcast.speakers[0];
      return firstSpeaker ? getFullSpeakerName(firstSpeaker) : undefined;
    });

    return {
      podcastPlayer,
      playOrPausePodcast,
      date,
      type,
      bannerSrcSet,
      speakerName,
    };
  },
});
</script>
