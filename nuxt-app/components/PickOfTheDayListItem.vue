<template>
  <li>
    <!-- Website URL -->
    <a
      class="
        group
        flex flex-col
        md:flex-row md:items-center md:space-x-8
        space-y-6
        md:space-y-0
      "
      :href="pickOfTheDay.website_url"
      target="_blank"
      rel="noreferrer"
      data-cursor-hover
    >
      <div class="w-56 md:w-44 lg:w-48 flex-shrink-0">
        <div class="w-full relative bg-gray-900" style="padding-top: 56.25%">
          <!-- Image -->
          <DirectusImage
            v-if="pickOfTheDay.image"
            class="w-full h-full absolute top-0 left-0 object-cover"
            :image="pickOfTheDay.image"
            :alt="pickOfTheDay.name"
            sizes="xs:224px md:176px lg:192px"
            loading="lazy"
          />
        </div>
      </div>

      <!-- Name and description -->
      <div class="text-white group-hover:text-blue">
        <div class="flex items-center space-x-4">
          <h3 class="text-lg md:text-xl lg:text-2xl font-black">
            {{ pickOfTheDay.name }}
          </h3>
          <div
            class="h-4 lg:h-5 xl:h-6 -mt-1"
            v-html="require('../assets/icons/leave-site.svg?raw')"
          />
        </div>
        <p
          class="
            text-base
            md:text-xl
            lg:text-2xl
            font-light
            leading-normal
            space-y-8
            mt-2
          "
          v-html="description"
        />
      </div>
    </a>
  </li>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { PickOfTheDayItem } from '../types';
import DirectusImage from './DirectusImage.vue';

export default defineComponent({
  components: {
    DirectusImage,
  },
  props: {
    pickOfTheDay: {
      type: Object as PropType<
        Pick<PickOfTheDayItem, 'name' | 'website_url' | 'description' | 'image'>
      >,
      required: true,
    },
  },
  setup(props) {
    const description = computed(() =>
      props.pickOfTheDay.description.replace(/<[^<>]+>/g, '')
    );

    return {
      description,
    };
  },
});
</script>
