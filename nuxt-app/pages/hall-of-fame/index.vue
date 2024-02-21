<template>
  <div v-if="hallOfFamePage && speakers" class="relative">
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
      "
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <SectionHeading class="mt-8 md:mt-0" element="h1">
        {{ hallOfFamePage.intro_heading }}
      </SectionHeading>
      <InnerHtml
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
        :html="hallOfFamePage.intro_text"
      />
    </div>

    <div>
      <!-- Tag Filter -->
      <TagFilter
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-12 md:mt-20 lg:mt-32"
        :tags="tagFilter.tags"
        :toggle-tag="tagFilter.toggleTag"
      />

      <!-- Speaker bubbles -->
      <div
        class="
          container
          overflow-hidden
          md:overflow-unset
          px-6
          md:pl-48
          lg:pr-8
          3xl:px-8
          pt-10
          xs:pt-14
          sm:pt-16
          lg:pt-20
          xl:pt-32
          pb-24
          md:pb-32
          lg:pb-52
        "
      >
        <LazyList
          class="flex flex-col items-baseline"
          :items="tagFilter.output"
          direction="vertical"
        >
          <template #default="{ item, index, viewportItems, addViewportItem }">
            <LazyListItem
              :key="item.id"
              :class="[
                index > 0 && 'mt-10',
                index % 2
                  ? 'self-end xs:-mt-10 sm:-mt-20 xl:-mt-32 2xl:-mt-60'
                  : 'xs:-mt-5 sm:-mt-10',
              ]"
              :item="item"
              :viewport-items="viewportItems"
              :add-viewport-item="addViewportItem"
            >
              <template #default="{ isNewToViewport }">
                <FadeAnimation
                  :fade-in="isNewToViewport ? 'from_bottom' : 'none'"
                >
                  <SpeakerBubble
                    :speaker="item"
                    :color="bubbleColors[index % 3]"
                  />
                </FadeAnimation>
              </template>
            </LazyListItem>
          </template>
        </LazyList>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useLoadingScreen, usePageMeta, useTagFilter } from '~/composables';
import { directus } from '~/services';
import type { HallOfFamePage, SpeakerItem, TagItem } from '~/types';
import LazyList from '~/components/LazyList.vue';
import LazyListItem from '~/components/LazyListItem.vue';

const breadcrumbs = [{ label: 'Hall of Fame' }];
const bubbleColors = ['pink', 'blue', 'lime'] as const;

// Query hall of fame page and speakers
const { data: pageData } = useAsyncData(async () => {
  const [hallOfFamePage, speakers] = await Promise.all([
    // Hall of fame page
    directus.singleton('hall_of_fame_page').read() as Promise<HallOfFamePage>,

    // Speakers
    (
      await directus.items('speakers').readByQuery({
        fields: [
          'id',
          'slug',
          'academic_title',
          'first_name',
          'last_name',
          'occupation',
          'profile_image.*',
          'tags.tag.id',
          'tags.tag.name',
        ],
        limit: -1,
        sort: ['sort', '-published_on'],
      })
    ).data?.map(({ tags, ...rest }) => ({
      ...rest,
      tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
        .map(({ tag }) => tag)
        .filter((tag) => tag),
    })) as Pick<
      SpeakerItem,
      | 'id'
      | 'slug'
      | 'academic_title'
      | 'first_name'
      | 'last_name'
      | 'occupation'
      | 'profile_image'
      | 'tags'
    >[],
  ]);
  return { hallOfFamePage, speakers };
});

// Extract hall of fame page and speakers from page data
const hallOfFamePage = computed(() => pageData.value?.hallOfFamePage);
const speakers = computed(() => pageData.value?.speakers);

// Set loading screen
useLoadingScreen(hallOfFamePage, speakers);

// Set page meta data
usePageMeta(hallOfFamePage);

// Create tag filter
const tagFilter = useTagFilter(speakers);
</script>
