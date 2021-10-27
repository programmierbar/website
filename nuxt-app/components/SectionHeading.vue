<template>
  <div class="md:h-full md:absolute md:z-10 md:left-0 md:top-0">
    <component
      :is="element"
      class="
        md:sticky md:left-6
        lg:left-8
        md:top-32
        lg:top-48
        md:vertical-rl
        text-2xl
        md:text-5xl
        lg:text-6xl
        text-white
        font-black
        md:whitespace-nowrap md:ml-6
      "
    >
      <slot />
    </component>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    element: {
      type: String as PropType<'h1' | 'h2'>,
      required: true,
    },
  },
});
</script>
