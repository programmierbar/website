<template>
  <div v-if="homePage && latestPodcasts && podcastCount">
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
        <div
          class="h-6 md:h-8 lg:h-16 inline-block first:inline"
          v-html="brandLogoIcon"
          alt="programmier.bar Logo"
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
import { computed } from 'vue';
import { DIRECTUS_CMS_URL } from '../config';

import { useLoadingScreen, usePageMeta } from '../composables';
import { directus } from '../services';
import { HomePage, PodcastItem } from '../types';

const breadcrumbs = [{ label: 'Home' }];

// Query home page, latest podcasts and podcast count
const { data: pageData } = useAsyncData(async () => {
  const [homePage, latestPodcasts, podcastCount] = await Promise.all([
    // Home page
    directus
      .singleton('home_page')
      .read({
        fields: ['*', 'video.*'],
      })
      .then(
        (homePage) =>
          homePage && {
            ...homePage,
            news: (homePage.news as { text: string }[]).map(({ text }) => text),
          }
      ) as Promise<HomePage>,

    // Latest podcasts
    (
      await directus.items('podcasts').readByQuery({
        fields: [
          'id',
          'slug',
          'published_on',
          'type',
          'number',
          'title',
          'cover_image.*',
          'audio_url',
        ],
        sort: ['-published_on'],
        limit: 10,
      })
    ).data as Pick<
      PodcastItem,
      | 'id'
      | 'slug'
      | 'published_on'
      | 'type'
      | 'number'
      | 'title'
      | 'cover_image'
      | 'audio_url'
    >[],

    // Podcast count
    (
      await directus.items('podcasts').readByQuery({
        limit: 0,
        meta: 'total_count',
      })
    ).meta?.total_count,
  ]);
  return { homePage, latestPodcasts, podcastCount };
});

// Extract home page, latest podcasts and podcast count from page data
const homePage = computed(() => pageData.value?.homePage);
const latestPodcasts = computed(() => pageData.value?.latestPodcasts);
const podcastCount = computed(() => pageData.value?.podcastCount);

// Set loading screen
useLoadingScreen(homePage);

// Set page meta data
usePageMeta(homePage);

// Create Video URL
const videoUrl = computed(
  () => homePage && `${DIRECTUS_CMS_URL}/assets/${homePage.value?.video.id}`
);
</script>
