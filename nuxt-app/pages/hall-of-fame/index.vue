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
        {{ hallOfFamePage.intro_text }}
      </p>
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
          <template #default="{ item, index }">
            <li
              :key="item.id"
              :class="[
                index > 0 && 'mt-10',
                index % 2
                  ? 'self-end xs:-mt-10 sm:-mt-20 xl:-mt-32 2xl:-mt-60'
                  : 'xs:-mt-5 sm:-mt-10',
              ]"
            >
              <SpeakerBubble :speaker="item" :color="bubbleColors[index % 3]" />
            </li>
          </template>
        </LazyList>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  LazyList,
  SectionHeading,
  SpeakerBubble,
  TagFilter,
} from '../../components';
import { useStrapi, useTagFilter, usePageMeta } from '../../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    LazyList,
    SectionHeading,
    SpeakerBubble,
    TagFilter,
  },
  setup() {
    // Query Strapi hall of fame page and speakers
    const hallOfFamePage = useStrapi('hall-of-fame-page');
    const speakers = useStrapi('speakers', '?_limit=-1');

    // Set page meta data
    usePageMeta(hallOfFamePage);

    // Create sorted speakers
    const sortedSpeakers = computed(() =>
      speakers.value?.sort((a, b) =>
        (a.position || Infinity) < (b.position || Infinity) ? -1 : 1
      )
    );

    // Create tag filter
    const tagFilter = useTagFilter(sortedSpeakers);

    return {
      hallOfFamePage,
      speakers,
      breadcrumbs: [{ label: 'Hall of Fame' }],
      bubbleColors: ['pink', 'blue', 'lime'] as const,
      tagFilter,
    };
  },
  head: {},
});
</script>
