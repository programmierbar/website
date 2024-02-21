<template>
  <ul class="space-y-12 md:space-y-16 lg:space-y-20">
    <PickOfTheDayListItem
      v-for="pickOfTheDay of picksOfTheDay"
      :key="pickOfTheDay.id"
      :pick-of-the-day="pickOfTheDay"
    />
  </ul>
</template>

<script lang="ts">
import type { PropType } from 'vue';
import { defineComponent } from 'vue';
import type { PickOfTheDayItem } from '../types';
import PickOfTheDayListItem from './PickOfTheDayListItem.vue';

export default defineComponent({
  components: {
    PickOfTheDayListItem,
  },
  props: {
    picksOfTheDay: {
      type: Array as PropType<
        Pick<
          PickOfTheDayItem,
          'id' | 'name' | 'website_url' | 'description' | 'image'
        >[]
      >,
      required: true,
    },
  },
});
</script>
