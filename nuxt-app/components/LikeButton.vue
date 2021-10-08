<template>
  <div class="flex items-center space-x-2 lg:space-x-3">
    <!-- TODO: Increase likes on click -->
    <button
      class="text-pink"
      :class="
        variant === 'pick_of_the_day_card'
          ? 'h-5 xs:h-6 md:h-7 xl:h-8'
          : 'h-6 md:h-8 lg:h-10'
      "
      type="button"
      data-cursor-hover
      v-html="require('../assets/icons/heart.svg?raw')"
    />
    <div
      class="md:text-lg text-pink font-black mt-1"
      :class="
        variant === 'pick_of_the_day_card'
          ? 'text-sm xs:text-base xl:text-xl'
          : 'text-base lg:text-2xl'
      "
    >
      <!-- TODO: Make counter dynamic via props -->
      200
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    variant: {
      type: String as PropType<'default' | 'pick_of_the_day_card'>,
      default: 'default',
    },
  },
});
</script>
