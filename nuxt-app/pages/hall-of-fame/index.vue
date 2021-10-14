<template>
  <div
    v-if="hallOfFamePage && speakers"
    class="relative overflow-hidden md:overflow-unset"
  >
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
        pb-24
        md:pb-32
        lg:pb-52
      "
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <SectionHeading class="mt-8 md:mt-0" tag="h1">
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

      <!-- Speaker bubbles -->
      <ul
        class="
          flex flex-col
          items-baseline
          mt-20
          xs:mt-28
          sm:mt-32
          lg:mt-44
          xl:mt-60
        "
      >
        <li
          v-for="(speaker, index) of speakers"
          :key="speaker.id"
          :class="[
            index > 0 && 'mt-10',
            index % 2
              ? 'self-end xs:-mt-10 sm:-mt-20 xl:-mt-32 2xl:-mt-60'
              : 'xs:-mt-5 sm:-mt-10',
          ]"
        >
          <SpeakerBubble :speaker="speaker" :color="bubbleColors[index % 3]" />
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from '@nuxtjs/composition-api';
import { Breadcrumbs, SectionHeading, SpeakerBubble } from '../../components';
import { useStrapi, usePageMeta } from '../../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    SectionHeading,
    SpeakerBubble,
  },
  setup() {
    // Query Strapi hall of fame page and speakers
    const hallOfFamePage = useStrapi('hall-of-fame-page');
    const speakers = useStrapi('speakers', ref('?_limit=-1'));

    // Set page meta data
    usePageMeta(hallOfFamePage);

    return {
      hallOfFamePage,
      speakers,
      breadcrumbs: [{ label: 'Hall of Fame' }],
      bubbleColors: ['pink', 'blue', 'lime'] as const,
    };
  },
  head: {},
});
</script>
