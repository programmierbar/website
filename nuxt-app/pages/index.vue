<template>
  <div v-if="homePage && podcastCount">
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
          alt="programmier.bar Logo"
        />:
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
      v-if="homePage.podcasts.length"
      class="relative py-16 md:py-28 lg:py-36 md:my-14 lg:my-24"
    >
      <SectionHeading class="px-6 md:px-0" element="h2">
        {{ homePage.podcast_heading }}
      </SectionHeading>
      <PodcastSlider
        class="mt-10 md:mt-0"
        :podcasts="homePage.podcasts"
        :podcast-count="podcastCount"
        show-podcast-link
      />
    </section>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from '@nuxtjs/composition-api';
import { DIRECTUS_CMS_URL } from '../config';
import {
  Breadcrumbs,
  NewsTicker,
  PodcastSlider,
  SectionHeading,
  ScrollDownMouse,
  TypedText,
} from '../components';
import { useAsyncData, useLoadingScreen, usePageMeta } from '../composables';
import { directus } from '../services';
import { HomePage, PodcastItem } from '../types';

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
    // Query home page and podcast count
    const pageData = useAsyncData(async () => {
      const [homePage, podcastCount] = await Promise.all([
        // Home page
        directus
          .singleton('home_page')
          .read({
            fields: [
              '*',
              'video.*',
              'podcasts.podcast.id',
              'podcasts.podcast.slug',
              'podcasts.podcast.published_on',
              'podcasts.podcast.type',
              'podcasts.podcast.number',
              'podcasts.podcast.title',
              'podcasts.podcast.cover_image.*',
              'podcasts.podcast.audio_url',
            ],
          })
          .then(
            (homePage) =>
              homePage && {
                ...homePage,
                news: (homePage.news as { text: string }[]).map(
                  ({ text }) => text
                ),
                podcasts: (
                  homePage.podcasts as {
                    podcast: Pick<
                      PodcastItem,
                      | 'id'
                      | 'slug'
                      | 'published_on'
                      | 'type'
                      | 'number'
                      | 'title'
                      | 'cover_image'
                      | 'audio_url'
                    >;
                  }[]
                ).map(({ podcast }) => podcast),
              }
          ) as Promise<HomePage>,

        // Podcast count
        (
          await directus.items('podcasts').readMany({
            limit: 0,
            meta: 'total_count',
          })
        ).meta?.total_count,
      ]);
      return { homePage, podcastCount };
    });

    // Extract home page and podcast count from page data
    const homePage = computed(() => pageData.value?.homePage);
    const podcastCount = computed(() => pageData.value?.podcastCount);

    // Set loading screen
    useLoadingScreen(homePage);

    // Set page meta data
    usePageMeta(homePage);

    // Create Video URL
    const videoUrl = computed(
      () => homePage && `${DIRECTUS_CMS_URL}/assets/${homePage.value?.video.id}`
    );

    return {
      homePage,
      podcastCount,
      breadcrumbs: [{ label: 'Home' }],
      videoUrl,
    };
  },
  head: {},
});
</script>
