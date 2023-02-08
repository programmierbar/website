<template>
  <div
    ref="fadeElement"
    class="transition"
    :class="[
      isVisible ||
      (isFadeIn && fadeIn === 'none') ||
      (!isFadeIn && fadeOut === 'none')
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
    :style="{
      transitionDuration: `${duration}ms`,
      transitionDelay: `${delay}ms`,
    }"
  >
    <slot />
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  PropType,
  ref,
} from '@nuxtjs/composition-api';
import { useIntersectionObserver } from '../composables';

export default defineComponent({
  props: {
    fadeIn: {
      type: String as PropType<
        | 'normal'
        | 'from_top'
        | 'from_right'
        | 'from_bottom'
        | 'from_left'
        | 'none'
      >,
      default: 'none',
    },
    fadeOut: {
      type: String as PropType<
        'to_top' | 'to_right' | 'to_bottom' | 'to_left' | 'none'
      >,
      default: 'none',
    },
    duration: {
      type: Number,
      default: 300,
    },
    delay: {
      type: Number,
      default: 0,
    },
    threshold: {
      type: Number,
      default: 0.25,
    },
  },
  setup(props) {
    // Create fade element reference
    const fadeElement = ref<HTMLDivElement>();

    // Create is visible and is fade in reference
    const isVisible = ref(props.fadeIn === 'none');
    const isFadeIn = ref(true);

    // Create observation target
    const observationTarget = computed(() =>
      props.fadeIn !== 'none' || props.fadeOut !== 'none'
        ? fadeElement.value
        : null
    );

    /**
     * It handels the visibility and fade in state.
     */
    const handleIntersection: IntersectionObserverCallback = ([
      { isIntersecting },
    ]) => {
      // Get next is fade in value
      const nextIsFadeIn = !isVisible.value && isIntersecting;

      // Change state only if is fade in or if fade out is "none"
      if (nextIsFadeIn || props.fadeOut !== 'none') {
        isFadeIn.value = nextIsFadeIn;
        isVisible.value = isIntersecting;

        // If it is fade out, reset is fade in after 300 ms
        if (!nextIsFadeIn) {
          setTimeout(() => {
            isFadeIn.value = true;
          }, 300);
        }
      }

      // Disconnect intersection observer when element
      // is intersecting and fade out is "none"
      if (isIntersecting && props.fadeOut === 'none') {
        intersectionObserver.disconnect();
      }
    };

    // Add intersection observer to element
    const intersectionObserver = useIntersectionObserver(
      observationTarget,
      handleIntersection,
      {
        threshold: props.threshold,
      }
    );

    return {
      fadeElement,
      isVisible,
      isFadeIn,
    };
  },
});
</script>
