<template>
  <div>
    <ul
      class="flex flex-wrap -m-1.5 md:-m-2"
      :class="variant === 'pick_of_the_day_card' && 'lg:-m-1.5 xl:-m-2'"
    >
      <li v-for="(tag, index) of tags" :key="tag.id">
        <button
          class="font-light rounded-full transition-colors"
          :class="[
            variant === 'default' &&
              'hover:bg-lime hover:selection:bg-black hover:selection:text-white',
            variant === 'pick_of_the_day_card' &&
              'hover:bg-opacity-0 border-2 border-gray-800 text-xs xs:text-sm xl:text-lg px-3 py-0.5 md:px-5 md:py-1 lg:px-3 lg:py-0.5 xl:px-5 xl:py-1 m-1.5 md:m-2 lg:m-1.5 xl:m-2',
            (variant === 'default' || variant === 'pick_of_the_day_card') &&
              'hover:text-black',
            (variant === 'default' || variant === 'tag_filter') &&
              'text-sm md:text-base lg:text-lg px-5 py-1 m-1.5 md:m-2',
            variant === 'tag_filter' && tag.isActive
              ? 'bg-lime selection:bg-black text-black selection:text-white'
              : 'bg-gray-800 text-white',
          ]"
          type="button"
          data-cursor-hover
          @click="() => onClick(tag, index)"
        >
          {{ tag.name }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiTag } from 'shared-code';

interface Tag extends StrapiTag {
  isActive?: boolean;
}

export default defineComponent({
  props: {
    tags: {
      type: Array as PropType<Tag[]>,
      required: true,
    },
    onClick: {
      type: Function as PropType<(tag: Tag, index: number) => void>,
      required: true,
    },
    variant: {
      type: String as PropType<
        'default' | 'tag_filter' | 'pick_of_the_day_card'
      >,
      default: 'default',
    },
  },
});
</script>
