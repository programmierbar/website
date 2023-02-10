<template>
  <div v-if="pickOfTheDayPage && picksOfTheDay" class="relative">
    <div
      class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 pt-32 md:pt-40 lg:pt-56 2xl:pt-64 pb-20 md:pb-32 lg:pb-52"
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <SectionHeading class="mt-8 md:mt-0" element="h1">
        {{ pickOfTheDayPage.intro_heading }}
      </SectionHeading>
      <InnerHtml
        class="text-lg md:text-2xl lg:text-3xl text-white md:font-bold leading-normal md:leading-normal lg:leading-normal mt-8 md:mt-16"
        :html="pickOfTheDayPage.intro_text"
      />

      <!-- Tag Filter -->
      <TagFilter
        class="mt-12 md:mt-20 lg:mt-32"
        :tags="tagFilter.tags"
        :toggle-tag="tagFilter.toggleTag"
      />

      <!-- Picks of the day -->
      <LazyList
        class="lg:flex lg:flex-col lg:items-baseline mt-12 md:mt-16 lg:mt-28"
        :items="tagFilter.output"
        direction="vertical"
      >
        <template #default="{ item, index, viewportItems, addViewportItem }">
          <LazyListItem
            :key="item.id"
            class="lg:w-1/2"
            :class="[
              index > 0 && 'mt-8 md:mt-12',
              index > 0 && index % 2 === 0 && 'lg:mt-44',
              index % 2 > 0 && 'lg:self-end lg:-mt-2/7',
            ]"
            :item="item"
            :viewport-items="viewportItems"
            :add-viewport-item="addViewportItem"
          >
            <template #default="{ isNewToViewport }">
              <FadeAnimation
                :fade-in="isNewToViewport ? 'from_bottom' : 'none'"
                :threshold="0"
              >
                <PickOfTheDayCard
                  :class="[
                    index % 2 === 0 ? 'lg:origin-left' : 'lg:origin-right',
                    (index + 3) % 4 < 2 ? 'lg:scale-70' : 'lg:scale-110',
                  ]"
                  :pick-of-the-day="item"
                  :variant="(index + 3) % 4 < 2 ? 'small' : 'large'"
                />
              </FadeAnimation>
            </template>
          </LazyListItem>
        </template>
      </LazyList>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useLoadingScreen, usePageMeta, useTagFilter } from '../composables';
import { directus } from '../services';
import {
  PickOfTheDayPage,
  PickOfTheDayItem,
  PodcastItem,
  TagItem,
} from '../types';

const breadcrumbs = [{ label: 'Pick of the Day' }];

// Query pick of the day page and picks of the day
const { data: pageData } = useAsyncData(async () => {
  const [pickOfTheDayPage, picksOfTheDay] = await Promise.all([
    // Pick of the Day page
    directus
      .singleton('pick_of_the_day_page')
      .read() as Promise<PickOfTheDayPage>,

    // Picks of the day
    (
      await directus.items('picks_of_the_day').readByQuery({
        fields: [
          'id',
          'name',
          'website_url',
          'description',
          'image.*',
          'podcast.slug',
          'podcast.type',
          'podcast.number',
          'podcast.title',
          'tags.tag.id',
          'tags.tag.name',
        ],
        limit: -1,
        sort: ['-published_on'],
      })
    ).data?.map(({ tags, ...rest }) => ({
      ...rest,
      tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
        .map(({ tag }) => tag)
        .filter((tag) => tag),
    })) as (Pick<
      PickOfTheDayItem,
      'id' | 'name' | 'website_url' | 'description' | 'image'
    > & {
      podcast: Pick<PodcastItem, 'slug' | 'type' | 'number' | 'title'> | null;
      tags: Pick<TagItem, 'id' | 'name'>[];
    })[],
  ]);
  return { pickOfTheDayPage, picksOfTheDay };
});

// Extract pick of the day page and picks of the day from page data
const pickOfTheDayPage = computed(() => pageData.value?.pickOfTheDayPage);
const picksOfTheDay = computed(() => pageData.value?.picksOfTheDay);

// Set loading screen
useLoadingScreen(pickOfTheDayPage, picksOfTheDay);

// Set page meta data
usePageMeta(pickOfTheDayPage);

// Create tag filter
const tagFilter = useTagFilter(picksOfTheDay);
</script>
