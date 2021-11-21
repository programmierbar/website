<template>
  <div class="relative flex justify-center">
    <button
      class="
        w-8
        lg:w-12
        h-16
        lg:h-24
        absolute
        z-20
        -top-10
        lg:-top-14
        hidden
        md:flex
        justify-center
        border-4
        lg:border-6
        border-lime
        rounded-full
      "
      :class="!opacity && 'invisible'"
      :style="{ opacity }"
      type="button"
      title="Scroll down"
      data-cursor-hover
      @click="scrollDown"
    >
      <div class="animate-scroll w-1.5 lg:w-2 h-4 lg:h-6 bg-lime origin-top" />
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from '@nuxtjs/composition-api';
import smoothscroll from 'smoothscroll-polyfill';
import { useEventListener, useWindow } from '../composables';
import { trackGoal } from '../helpers';

export default defineComponent({
  setup() {
    // Add opacity reference
    const opacity = ref(1);

    /**
     * It updates the opacity based on the scroll
     * position and the height of the viewport.
     */
    const handleOpacity = () => {
      const { scrollY, innerHeight } = window;
      const maxHeight = innerHeight / 2;
      opacity.value = (maxHeight - Math.min(scrollY, maxHeight)) / maxHeight;
    };

    // Add scroll event listener to window object
    useEventListener(useWindow(), 'scroll', handleOpacity);

    /**
     * It scrolls the page down a bit.
     */
    const scrollDown = () => {
      trackGoal(process.env.NUXT_ENV_CLICK_SCROLL_DOWN_MOUSE_EVENT!);
      const { scrollY, innerHeight } = window;
      window.scrollTo({
        top: scrollY + innerHeight / 2,
        behavior: 'smooth',
      });
    };

    // Add smooth scroll polyfill
    onMounted(smoothscroll.polyfill);

    return {
      opacity,
      scrollDown,
    };
  },
});
</script>

<style lang="postcss" scoped>
@keyframes scroll-down {
  0% {
    transform-origin: top;
    transform: translateY(70%) scaleY(0);
  }
  15% {
    transform-origin: top;
    transform: translateY(70%) scaleY(0.7);
  }
  30% {
    transform-origin: top;
    transform: translateY(100%) scaleY(1);
  }
  40% {
    transform-origin: bottom;
    transform: translateY(135%) scaleY(1);
  }
  60% {
    transform-origin: bottom;
    transform: translateY(170%) scaleY(0.5);
  }
  80% {
    transform-origin: bottom;
    transform: translateY(170%) scaleY(0);
  }
  100% {
    transform-origin: bottom;
    transform: translateY(170%) scaleY(0);
  }
}
.animate-scroll {
  animation: scroll-down 1.3s linear infinite forwards;
}
</style>
