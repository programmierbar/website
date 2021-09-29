<template>
  <ul class="space-y-14 md:space-y-24">
    <li
      v-for="speaker of speakers"
      :key="speaker.id"
      class="flex md:items-center flex-col md:flex-row-reverse"
    >
      <!-- Event image -->
      <img
        v-if="speaker.event_image"
        class="
          md:w-1/2 md:h-60
          lg:h-80
          xl:h-96
          2xl:h-112
          object-cover
          md:ml-16
          lg:ml-20
        "
        :src="speaker.event_image.url"
        :srcset="getImageSrcSet(speaker.event_image)"
        sizes="
          (min-width: 2000px) 696px,
          (min-width: 1536px) 656px,
          (min-width: 768px) 40vw,
          90vw
        "
        loading="lazy"
        :alt="speaker.event_image.alternativeText || getfullName(speaker)"
      />
      <div class="md:w-1/2 mt-10 md:mt-0">
        <!-- Name -->
        <h3 class="text-xl md:text-2xl lg:text-3xl text-white font-black">
          {{ getfullName(speaker) }}
        </h3>

        <!-- Description -->
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            leading-normal
            line-clamp-4
            space-y-8
            mt-5
            md:mt-10
          "
          :markdown="speaker.description"
        />

        <!-- Link -->
        <LinkButton class="mt-6" :href="`/hall-of-fame/${speaker.id}`">
          Mehr Infos
        </LinkButton>
      </div>
    </li>
  </ul>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiSpeaker } from 'shared-code';
import { getImageSrcSet } from '../helpers';
import LinkButton from './LinkButton.vue';
import MarkdownToHtml from './MarkdownToHtml.vue';

export default defineComponent({
  components: {
    LinkButton,
    MarkdownToHtml,
  },
  props: {
    speakers: {
      type: Array as PropType<StrapiSpeaker[]>,
      required: true,
    },
  },
  setup() {
    // Create get full name function
    const getfullName = (speaker: StrapiSpeaker) =>
      `${speaker.academic_title || ''} ${speaker.first_name} ${
        speaker.last_name
      }`.trim();

    return { getImageSrcSet, getfullName };
  },
});
</script>
