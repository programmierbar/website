<template>
  <div v-if="homePage">
    <section class="container px-6 lg:px-8 mt-28 md:mt-40">
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
        <TypedText>
          {{ homePage.intro_text }}
        </TypedText>
      </h1>

      <!-- Scroll down mouse -->
      <ScrollDownMouse class="relative top-16 lg:top-20" />
    </section>

    <section class="mt-16 md:mt-10">
      <!-- Video -->
      <video
        class="w-full min-h-80 max-h- object-cover"
        :src="homePage.video.url"
        :alt="homePage.video.alternativeText"
        autoplay="true"
        loop="true"
        muted="true"
      />

      <!-- Newsticker -->
      <div
        class="h-20 lg:h-36 flex items-center bg-lime overflow-hidden"
        data-cursor-black
      >
        <p class="news-ticker text-xl lg:text-4xl italic whitespace-nowrap">
          <span v-for="item in 2" :key="item">
            <span v-for="newsItem in news" :key="newsItem">
              {{ newsItem }}
              <span class="font-black mx-5">+++</span>
            </span>
          </span>
        </p>
      </div>
    </section>

    <!-- Podcasts -->
    <section
      v-if="homePage.podcasts.length"
      class="relative py-16 md:py-40 lg:py-60"
    >
      <SectionHeading class="px-6 md:px-0" tag="h2">
        {{ homePage.podcast_heading }}
      </SectionHeading>
      <PodcastCarousel class="mt-10 md:mt-0" :podcasts="homePage.podcasts" />
    </section>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  PodcastCarousel,
  SectionHeading,
  ScrollDownMouse,
  TypedText,
} from '../components';
import { useStrapi, usePageMeta } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    PodcastCarousel,
    SectionHeading,
    ScrollDownMouse,
    TypedText,
  },
  setup() {
    // Query Strapi home-page
    const homePage = useStrapi('home-page');

    // Set page meta data
    usePageMeta(homePage);

    // Create news list
    const news = computed(() =>
      homePage.value?.news
        ?.replace(/(^- |\n- )/g, '|')
        .split('|')
        .slice(1)
    );

    return {
      homePage,
      news,
      breadcrumbs: [{ label: 'Home' }],
    };
  },
  head: {},
});
</script>

<style scoped>
@keyframes news-ticker {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
.news-ticker {
  animation: news-ticker 30s linear infinite;
}
</style>
