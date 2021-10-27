<template>
  <div v-if="podcastPage && podcasts">
    <section class="relative">
      <!-- Page cover -->
      <PageCoverImage :cover-image="podcastPage.cover_image" />
      <div
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-16 md:mt-28 lg:mt-32"
      >
        <Breadcrumbs :breadcrumbs="breadcrumbs" />

        <!-- Page intro -->
        <SectionHeading class="md:pt-96 lg:pt-120 mt-8 md:mt-0" element="h1">
          {{ podcastPage.intro_heading }}
        </SectionHeading>
        <p
          class="
            text-lg
            md:text-2xl
            lg:text-3xl
            text-white
            md:font-bold
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-16
          "
        >
          {{ podcastPage.intro_text_1 }}
        </p>
        <p
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            md:font-normal
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-6
          "
        >
          {{ podcastPage.intro_text_2 }}
        </p>
      </div>
    </section>

    <div>
      <!-- Tag Filter -->
      <TagFilter
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-8 md:mt-20 lg:mt-32"
        :tags="tagFilter.tags"
        :toggle-tag="tagFilter.toggleTag"
      />

      <!-- Deep dive podcasts -->
      <section
        v-if="deepDivePodcasts.length"
        class="
          relative
          md:pl-40
          3xl:px-0
          py-8
          md:py-10
          lg:py-16
          md:my-12
          lg:my-16
        "
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.deep_dive_heading }}
        </SectionHeading>
        <PodcastCarousel class="mt-10 md:mt-0" :podcasts="deepDivePodcasts" />
      </section>

      <!-- CTO special podcasts -->
      <section
        v-if="ctoSpecialPodcasts.length"
        class="
          relative
          md:pl-40
          3xl:px-0
          py-8
          md:py-10
          lg:py-16
          md:my-12
          lg:my-16
        "
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.cto_special_heading }}
        </SectionHeading>
        <PodcastCarousel class="mt-10 md:mt-0" :podcasts="ctoSpecialPodcasts" />
      </section>

      <!-- News podcasts -->
      <section
        v-if="newsPodcasts.length"
        class="
          relative
          md:pl-40
          3xl:px-0
          py-8
          md:py-10
          lg:py-16
          md:mt-12
          lg:mt-16
          mb-8
          md:mb-28
          lg:mb-40
        "
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.news_heading }}
        </SectionHeading>
        <PodcastCarousel class="mt-10 md:mt-0" :podcasts="newsPodcasts" />
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  PageCoverImage,
  PodcastCarousel,
  SectionHeading,
  TagFilter,
} from '../../components';
import { useStrapi, useTagFilter, usePageMeta } from '../../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    PageCoverImage,
    PodcastCarousel,
    SectionHeading,
    TagFilter,
  },
  setup() {
    // Query Strapi about page and members
    const podcastPage = useStrapi('podcast-page');
    const podcasts = useStrapi('podcasts', ref('?_limit=-1'));

    // Set page meta data
    usePageMeta(podcastPage);

    // Create podcast tag filter
    const tagFilter = useTagFilter(podcasts);

    // Create deep dive podcasts list
    const deepDivePodcasts = computed(() =>
      tagFilter.output
        .filter((podcast) => podcast.type === 'deep_dive')
        .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    );

    // Create CTO special podcasts list
    const ctoSpecialPodcasts = computed(() =>
      tagFilter.output
        .filter((podcast) => podcast.type === 'cto_special')
        .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    );

    // Create news podcasts list
    const newsPodcasts = computed(() =>
      tagFilter.output
        .filter((podcast) => podcast.type === 'news')
        .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    );

    return {
      podcastPage,
      podcasts,
      breadcrumbs: [{ label: 'Podcast' }],
      tagFilter,
      deepDivePodcasts,
      ctoSpecialPodcasts,
      newsPodcasts,
    };
  },
  head: {},
});
</script>
