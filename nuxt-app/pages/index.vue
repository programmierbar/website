<template>
  <div v-if="homePage">
    <section
      class="
        container
        px-6
        lg:px-8
        pt-32
        md:pt-40
        lg:pt-56
        2xl:pt-64
        pb-24
        md:pb-32
        lg:pb-52
      "
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <h1
        class="
          text-2xl
          md:text-3xl
          lg:text-6xl
          text-white
          font-black
          leading-normal
          md:leading-normal
          lg:leading-normal
          mt-3
          md:mt-6
        "
      >
        <img
          class="h-6 md:h-8 lg:h-16 inline"
          :src="require('~/assets/images/brand-logo.svg')"
          alt="programier.bar Logo"
        />:
        <TypedText :text="homePage.intro_text" />
      </h1>
    </section>

    <section>
      <!-- Scroll down mouse -->
      <ScrollDownMouse />

      <!-- Video -->
      <video
        class="w-full min-h-80 object-cover"
        :src="homePage.video.url"
        :alt="homePage.video.alternativeText"
        autoplay="true"
        loop="true"
        muted="true"
        playsinline
      />

      <!-- Newsticker -->
      <NewsTicker :markdown="homePage.news" />
    </section>

    <!-- Podcasts -->
    <section
      v-if="homePage.podcasts.length"
      class="relative py-16 md:py-28 lg:py-36 md:my-14 lg:my-24"
    >
      <SectionHeading class="px-6 md:px-0" element="h2">
        {{ homePage.podcast_heading }}
      </SectionHeading>
      <PodcastSlider class="mt-10 md:mt-0" :podcasts="homePage.podcasts" />
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  NewsTicker,
  PodcastSlider,
  SectionHeading,
  ScrollDownMouse,
  TypedText,
} from '../components';
import { useStrapi, usePageMeta } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    NewsTicker,
    PodcastSlider,
    SectionHeading,
    ScrollDownMouse,
    TypedText,
  },
  setup() {
    // Query Strapi home-page
    const homePage = useStrapi('home-page');

    // Set page meta data
    usePageMeta(homePage);

    return {
      homePage,
      breadcrumbs: [{ label: 'Home' }],
    };
  },
  head: {},
});
</script>
