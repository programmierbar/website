<template>
  <div>
    <ul
      class="flex flex-wrap -m-1.5 md:-m-2"
      :class="variant === 'pick_of_the_day_card' && 'lg:-m-1.5 xl:-m-2'"
    >
      <li v-for="(tag, index) of tags" :key="tag.id">
        <button
          class="font-light rounded-full transition-colors m-1.5 md:m-2"
          :class="[
            variant === 'default' &&
              'hover:bg-lime hover:selection:bg-black hover:selection:text-white',
            variant === 'pick_of_the_day_card' &&
              'hover:bg-opacity-0 border-2 border-gray-700 text-xs xs:text-sm xl:text-base px-3 md:px-4 lg:px-3 xl:px-4 pt-0.75 md:pt-1.25 lg:pt-0.75 xl:pt-1.25 pb-0.5 md:pb-1 lg:pb-0.5 xl:pb-1 lg:m-1.5 xl:m-2',
            (variant === 'default' || variant === 'pick_of_the_day_card') &&
              'hover:text-black',
            (variant === 'default' || variant === 'tag_filter') &&
              'text-sm md:text-base lg:text-lg px-4 md:px-5 pt-1.25 pb-1',
            variant === 'tag_filter' && tag.is_active
              ? 'bg-lime selection:bg-black text-black selection:text-white'
              : 'bg-gray-700 text-white',
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
import { defineComponent, PropType } from 'vue';
import { TagItem } from '../types';

interface Tag extends Pick<TagItem, 'id' | 'name'> {
  is_active?: boolean;
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
