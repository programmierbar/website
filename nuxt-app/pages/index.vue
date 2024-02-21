<template>
  <div v-if="homePage && latestPodcasts && podcastCount">
    <section
      class="container px-6 lg:px-8 pt-32 md:pt-40 lg:pt-56 2xl:pt-64 pb-24 md:pb-32 lg:pb-52"
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <h1
        class="text-2xl md:text-3xl lg:text-6xl text-white font-black leading-normal md:leading-normal lg:leading-normal mt-3 md:mt-6"
      >
        <div
          class="h-6 md:h-8 lg:h-16 inline-block inline-child"
          alt="programmier.bar Logo"
          v-html="brandLogoIcon"
        />
        :
        <TypedText :text="homePage.intro_heading" />
      </h1>
    </section>

    <section>
      <!-- Scroll down mouse -->
      <ScrollDownMouse />

      <!-- Video -->
      <div class="bg-gray-900">
        <video
          v-if="!isString(homePage.video)"
          class="w-full min-h-80 object-cover"
          :src="videoUrl"
          :alt="homePage.video.title || ''"
          autoplay="true"
          loop="true"
          muted="true"
          playsinline
        />
      </div>

      <!-- Newsticker -->
      <NewsTicker :news="homePage.news" />
    </section>

    <!-- Podcasts -->
    <section
      v-if="latestPodcasts.length"
      class="relative py-16 md:py-28 lg:py-36 md:my-14 lg:my-24"
    >
      <SectionHeading class="px-6 md:px-0" element="h2">
        {{ homePage.podcast_heading }}
      </SectionHeading>
      <PodcastSlider
        class="mt-10 md:mt-0"
        :podcasts="latestPodcasts"
        :podcast-count="podcastCount"
        show-podcast-link
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import brandLogoIcon from '~/assets/images/brand-logo.svg?raw';
import { computed, type ComputedRef } from 'vue';
import { DIRECTUS_CMS_URL } from '../config';

import { useLoadingScreen, usePageMeta } from '../composables';
import type { DirectusHomePage } from '../types';
import { generatePodcastSeries } from '~/helpers/jsonLdGenerator';
import { type LatestPodcasts, useDirectus } from '~/composables/useDirectus';
import { isString } from '@vue/shared';

const breadcrumbs = [{ label: 'Home' }];
const directus = useDirectus();

// Query home page, latest podcasts and podcast count
const { data: pageData } = useAsyncData(async () => {
  const [homePage, latestPodcasts, podcastCount] = await Promise.all([
    // Home page
    await directus.getHomepage({
      fields: ['*', 'video.*'],
    }),

    // Latest podcasts
    await directus.getLatestPodcasts(),

    // Podcast count
    directus.aggregateItems('podcasts', {
      aggregate: { count: '*' },
    }),
  ]);

  return { homePage, latestPodcasts, podcastCount };
});

// Extract home page, latest podcasts and podcast count from page data
const homePage: ComputedRef<DirectusHomePage | undefined> = computed(
  () => pageData.value?.homePage
);
const latestPodcasts: ComputedRef<LatestPodcasts | undefined> = computed(
  () => pageData.value?.latestPodcasts
);

const podcastCount = computed(() => pageData.value?.podcastCount);

// Set loading screen
useLoadingScreen(homePage);

// Set page meta data
usePageMeta(homePage);

useJsonld(generatePodcastSeries());

// Create Video URL
const videoUrl = computed(() => {
  if (!isString(homePage.value?.video)) {
    return (
      homePage.value && `${DIRECTUS_CMS_URL}/assets/${homePage.value?.video.id}`
    );
  }

  return undefined;
});
</script>

<style>
.inline-child > svg {
  display: inline;
}
</style>
