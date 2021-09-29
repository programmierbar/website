<template>
  <div>
    <ul
      class="flex flex-wrap -m-1.5 md:-m-2"
      :class="variant === 'pick_of_the_day_card' && 'lg:-m-1.5 xl:-m-2'"
    >
      <li
        v-for="tag of tags"
        :key="tag.id"
        class="
          bg-gray-800
          text-white
          hover:text-black
          font-light
          rounded-full
          transition-colors
        "
        :class="
          variant === 'pick_of_the_day_card'
            ? 'hover:bg-opacity-0 border-2 border-gray-800 text-xs xs:text-sm xl:text-lg px-3 py-0.5 md:px-5 md:py-1 lg:px-3 lg:py-0.5 xl:px-5 xl:py-1 m-1.5 md:m-2 lg:m-1.5 xl:m-2'
            : 'hover:bg-lime text-sm md:text-base lg:text-lg px-5 py-1 m-1.5 md:m-2'
        "
        data-cursor-hover
      >
        {{ tag.name }}
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiTag } from '~/../shared-code/lib';

export default defineComponent({
  props: {
    tags: {
      type: Array as PropType<StrapiTag[]>,
      required: true,
    },
    variant: {
      type: String as PropType<'default' | 'pick_of_the_day_card'>,
      default: 'default',
    },
  },
});
</script>
