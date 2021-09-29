<template>
  <ul class="space-y-12 md:space-y-16 lg:space-y-20">
    <li
      v-for="pickOfTheDay of picksOfTheDay"
      :key="pickOfTheDay.id"
      class="
        flex flex-col
        md:flex-row md:items-center md:space-x-8
        space-y-6
        md:space-y-0
      "
    >
      <div class="w-56 md:w-44 lg:w-48 flex-shrink-0">
        <div class="w-full relative bg-gray-900" style="padding-top: 56.25%">
          <img
            v-if="pickOfTheDay.image"
            class="w-full h-full absolute top-0 left-0 object-cover"
            :src="pickOfTheDay.image.url"
            :srcset="getImageSrcSet(pickOfTheDay.image)"
            sizes="
              (min-width: 1024px) 192px,
              (min-width: 768px) 176px,
              224px
            "
            loading="lazy"
            :alt="pickOfTheDay.image.alternativeText || pickOfTheDay.name"
          />
        </div>
      </div>
      <div>
        <h3 class="text-lg md:text-xl lg:text-2xl text-white font-black">
          {{ pickOfTheDay.name }}
        </h3>
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            leading-normal
            space-y-8
            mt-2
          "
          :markdown="pickOfTheDay.description"
        />
      </div>
    </li>
  </ul>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiPickOfTheDay } from 'shared-code';
import { getImageSrcSet } from '../helpers';
import MarkdownToHtml from './MarkdownToHtml.vue';

export default defineComponent({
  components: {
    MarkdownToHtml,
  },
  props: {
    picksOfTheDay: {
      type: Array as PropType<StrapiPickOfTheDay[]>,
      required: true,
    },
  },
  setup() {
    return { getImageSrcSet };
  },
});
</script>
