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
        <SectionHeading
          class="md:pt-2/5-screen lg:pt-1/2-screen mt-8 md:mt-0"
          element="h1"
        >
          {{ podcastPage.intro_heading }}
        </SectionHeading>
        <InnerHtml
          class="text-lg md:text-2xl lg:text-3xl text-white md:font-bold leading-normal md:leading-normal lg:leading-normal mt-8 md:mt-16"
          :html="podcastPage.intro_text_1"
        />
        <InnerHtml
          class="text-base md:text-xl lg:text-2xl text-white font-light md:font-normal leading-normal md:leading-normal lg:leading-normal mt-8 md:mt-6"
          :html="podcastPage.intro_text_2"
        />
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
        class="relative py-8 md:py-10 lg:py-16 md:my-12 lg:my-16"
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.deep_dive_heading }}
        </SectionHeading>
        <PodcastSlider class="mt-10 md:mt-0" :podcasts="deepDivePodcasts" />
      </section>

      <!-- CTO special podcasts -->
      <section
        v-if="ctoSpecialPodcasts.length"
        class="relative py-8 md:py-10 lg:py-16 md:my-12 lg:my-16"
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.cto_special_heading }}
        </SectionHeading>
        <PodcastSlider class="mt-10 md:mt-0" :podcasts="ctoSpecialPodcasts" />
      </section>

      <!-- News podcasts -->
      <section
        v-if="newsPodcasts.length"
        class="relative py-8 md:py-10 lg:py-16 md:mt-12 lg:mt-16 mb-8 md:mb-28 lg:mb-40"
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.news_heading }}
        </SectionHeading>
        <PodcastSlider class="mt-10 md:mt-0" :podcasts="newsPodcasts" />
      </section>

      <!-- Other podcasts -->
      <section
        v-if="otherPodcasts.length"
        class="relative py-8 md:py-10 lg:py-16 md:mt-12 lg:mt-16 mb-8 md:mb-28 lg:mb-40"
      >
        <SectionHeading class="px-6 md:px-0" element="h2">
          {{ podcastPage.other_heading }}
        </SectionHeading>
        <PodcastSlider class="mt-10 md:mt-0" :podcasts="otherPodcasts" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useLoadingScreen, usePageMeta, useTagFilter } from '../../composables';
import { directus } from '../../services';
import type { PodcastPage, PodcastItem, TagItem } from '../../types';

const breadcrumbs = [{ label: 'Podcast' }];

// Query about page and members
const { data: pageData } = useAsyncData(async () => {
  const [podcastPage, podcasts] = await Promise.all([
    // Podcast page
    directus
      .singleton('podcast_page')
      .read({ fields: '*.*' }) as Promise<PodcastPage>,

    // Podcasts
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
          'tags.tag.id',
          'tags.tag.name',
        ],
        sort: ['-published_on'],
        limit: -1,
      })
    ).data?.map(({ tags, ...rest }) => ({
      ...rest,
      tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
        .map(({ tag }) => tag)
        .filter((tag) => tag),
    })) as Pick<
      PodcastItem,
      | 'id'
      | 'slug'
      | 'published_on'
      | 'type'
      | 'number'
      | 'title'
      | 'cover_image'
      | 'audio_url'
      | 'tags'
    >[],
  ]);
  return { podcastPage, podcasts };
});

// Extract about page and members from page data
const podcastPage = computed(() => pageData.value?.podcastPage);
const podcasts = computed(() => pageData.value?.podcasts);

// Set loading screen
useLoadingScreen(podcastPage, podcasts);

// Set page meta data
usePageMeta(podcastPage);

// Create podcast tag filter
const tagFilter = useTagFilter(podcasts);

// Create deep dive podcasts list
const deepDivePodcasts = computed(() =>
  tagFilter.output.filter((podcast) => podcast.type === 'deep_dive')
);

// Create CTO special podcasts list
const ctoSpecialPodcasts = computed(() =>
  tagFilter.output.filter((podcast) => podcast.type === 'cto_special')
);

// Create news podcasts list
const newsPodcasts = computed(() =>
  tagFilter.output.filter((podcast) => podcast.type === 'news')
);

// Create news podcasts list
const otherPodcasts = computed(() =>
  tagFilter.output.filter((podcast) => podcast.type === 'other')
);
</script>
