<template>
  <div class="md:h-full md:absolute md:z-10 md:left-0 md:top-0">
    <div
      class="
        md:h-full
        md:max-h-screen
        md:sticky
        md:left-0
        md:top-0
        md:flex
        md:items-center
      "
    >
      <component
        :is="tag"
        class="
          md:vertical-rl
          text-2xl
          md:text-5xl
          lg:text-6xl
          text-white
          font-black
          whitespace-nowrap
          md:whitespace-normal md:ml-6
          lg:ml-8
        "
      >
        <slot />
      </component>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    tag: {
      type: String as PropType<'h1' | 'h2'>,
      required: true,
    },
  },
});
</script>
