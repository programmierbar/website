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
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiPickOfTheDay } from 'shared-code';
import PickOfTheDayListItem from './PickOfTheDayListItem.vue';

export default defineComponent({
  components: {
    PickOfTheDayListItem,
  },
  props: {
    picksOfTheDay: {
      type: Array as PropType<StrapiPickOfTheDay[]>,
      required: true,
    },
  },
});
</script>
