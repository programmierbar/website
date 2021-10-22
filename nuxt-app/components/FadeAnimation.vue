<template>
  <div
    ref="fadeElement"
    class="transition-all duration-300"
    :class="[
      isVisible || (!isFadeIn && fadeOut === 'none')
        ? 'opacity-100'
        : 'opacity-0',
      !isVisible &&
        isFadeIn &&
        ((fadeIn === 'from_top' &&
          '-translate-y-16 md:-translate-y-20 lg:-translate-y-28') ||
          (fadeIn === 'from_right' &&
            'translate-x-16 md:translate-x-20 lg:translate-x-28') ||
          (fadeIn === 'from_bottom' &&
            'translate-y-16 md:translate-y-20 lg:translate-y-28') ||
          (fadeIn === 'from_left' &&
            '-translate-x-16 md:-translate-x-20 lg:-translate-x-28')),
      !isVisible &&
        !isFadeIn &&
        ((fadeOut === 'to_top' &&
          '-translate-y-16 md:-translate-y-20 lg:-translate-y-28') ||
          (fadeOut === 'to_right' &&
            'translate-x-16 md:translate-x-20 lg:translate-x-28') ||
          (fadeOut === 'to_bottom' &&
            'translate-y-16 md:translate-y-20 lg:translate-y-28') ||
          (fadeOut === 'to_left' &&
            '-translate-x-16 md:-translate-x-20 lg:-translate-x-28')),
    ]"
  >
    <slot />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, watch } from '@nuxtjs/composition-api';
import { useIntersectionObserver } from '../composables';

export default defineComponent({
  props: {
    fadeIn: {
      type: String as PropType<
        'from_top' | 'from_right' | 'from_bottom' | 'from_left'
      >,
      required: true,
    },
    fadeOut: {
      type: String as PropType<
        'to_top' | 'to_right' | 'to_bottom' | 'to_left' | 'none'
      >,
      default: 'none',
    },
  },
  setup(props) {
    // Create fade element reference
    const fadeElement = ref<HTMLDivElement>();

    // Create is visible and is fade in reference
    const isVisible = ref(false);
    const isFadeIn = ref(true);

    /**
     * It handels the visibility and fade in state.
     */
    const handleIntersection: IntersectionObserverCallback = ([
      { isIntersecting },
    ]) => {
      const nextIsFadeIn = !isVisible.value && isIntersecting;
      if (nextIsFadeIn || props.fadeOut !== 'none') {
        isFadeIn.value = nextIsFadeIn;
        isVisible.value = isIntersecting;
        if (!nextIsFadeIn) {
          setTimeout(() => {
            isFadeIn.value = true;
          }, 300);
        }
      }
    };

    // Add intersection observer to element
    const intersectionObserver = useIntersectionObserver(
      fadeElement,
      handleIntersection,
      {
        threshold: 0.5,
      }
    );

    // Disconnect intersection observer when element
    // is visible and fade out in "none"
    watch(isVisible, () => {
      if (isVisible.value && props.fadeOut === 'none') {
        intersectionObserver.disconnect();
      }
    });

    return {
      fadeElement,
      isVisible,
      isFadeIn,
    };
  },
});
</script>
