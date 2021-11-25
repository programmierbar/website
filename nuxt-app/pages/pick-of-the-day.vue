<template>
  <div v-if="pickOfTheDayPage && picksOfTheDay" class="relative">
    <div
      class="
        container
        px-6
        md:pl-48
        lg:pr-8
        3xl:px-8
        pt-32
        md:pt-40
        lg:pt-56
        2xl:pt-64
        pb-20
        md:pb-32
        lg:pb-52
      "
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <SectionHeading class="mt-8 md:mt-0" element="h1">
        {{ pickOfTheDayPage.intro_heading }}
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
        {{ pickOfTheDayPage.intro_text }}
      </p>

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

<script lang="ts">
import { computed, defineComponent } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  FadeAnimation,
  LazyList,
  LazyListItem,
  PickOfTheDayCard,
  SectionHeading,
  TagFilter,
} from '../components';
import { useStrapi, useTagFilter, usePageMeta } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    FadeAnimation,
    LazyList,
    LazyListItem,
    PickOfTheDayCard,
    SectionHeading,
    TagFilter,
  },
  setup() {
    // Query Strapi pick of the day page and picks of the day
    const pickOfTheDayPage = useStrapi('pick-of-the-day-page');
    const picksOfTheDay = useStrapi('picks-of-the-day', '?_limit=-1');

    // Set page meta data
    usePageMeta(pickOfTheDayPage);

    // Create sorted picks of the day
    const sortedPicksOfTheDay = computed(() =>
      picksOfTheDay.value?.sort((a, b) =>
        a.published_at < b.published_at ? 1 : -1
      )
    );

    // Create tag filter
    const tagFilter = useTagFilter(sortedPicksOfTheDay);

    return {
      pickOfTheDayPage,
      picksOfTheDay,
      breadcrumbs: [{ label: 'Pick of the Day' }],
      tagFilter,
    };
  },
  head: {},
});
</script>
