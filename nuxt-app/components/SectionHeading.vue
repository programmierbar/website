<template>
  <component
    :is="tag"
    ref="headingElement"
    class="
      md:h-full md:absolute md:z-10 md:left-0 md:top-0 md:flex md:items-center
    "
  >
    <span
      class="
        relative
        md:vertical-rl
        text-2xl
        md:text-5xl
        lg:text-6xl
        text-white
        font-black
        whitespace-nowrap
        transition-opacity
        duration-1000
        md:ml-6
        lg:ml-8
      "
      :style="parallaxStyle"
    >
      <slot />
    </span>
  </component>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from '@nuxtjs/composition-api';
import { useMediaQuery, useScrollParallax } from '../composables';

export default defineComponent({
  props: {
    tag: {
      type: String,
      required: true,
    },
  },
  setup() {
    // Create element and state references
    const headingElement = ref<HTMLHeadingElement>();
    const scrollParallax = useScrollParallax(headingElement);
    const isNotMobile = useMediaQuery('(min-width: 768px)');

    // Create computed parallax style
    const parallaxStyle = computed(() => {
      if (headingElement.value && isNotMobile.value) {
        const { innerHeight } = window;
        const { clientHeight } = headingElement.value;
        const multiplier = -(Math.min(innerHeight / clientHeight, 0.8) - 1);
        return {
          transform: `translateY(${scrollParallax.offset * multiplier}px)`,
          opacity: scrollParallax.isVisible ? 1 : 0,
        };
      }
      return undefined;
    });

    return { headingElement, parallaxStyle };
  },
});
</script>
