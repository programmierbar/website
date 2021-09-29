<template>
  <div
    class="
      w-8
      lg:w-12
      h-16
      lg:h-24
      hidden
      md:flex
      justify-center
      border-4
      lg:border-6
      border-lime
      rounded-full
      mx-auto
    "
  >
    <div
      class="animate-scroll w-1.5 lg:w-2 h-4 lg:h-6 relative bg-lime origin-top"
    />
  </div>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api';

export default defineComponent({});
</script>

<style lang="postcss" scoped>
@keyframes scroll-down {
  0% {
    /* opacity: 0; */
    transform-origin: top;
    transform: translateY(70%) scaleY(0);
  }
  15% {
    /* opacity: 0; */
    transform-origin: top;
    transform: translateY(70%) scaleY(0.7);
  }
  30% {
    /* opacity: 1; */
    transform-origin: top;
    transform: translateY(100%) scaleY(1);
  }
  40% {
    /* opacity: 1; */
    transform-origin: bottom;
    transform: translateY(135%) scaleY(1);
  }
  60% {
    /* opacity: 1; */
    transform-origin: bottom;
    transform: translateY(170%) scaleY(0.5);
  }
  80% {
    /* opacity: 0; */
    transform-origin: bottom;
    transform: translateY(170%) scaleY(0);
  }
  100% {
    /* opacity: 0; */
    transform-origin: bottom;
    transform: translateY(170%) scaleY(0);
  }
}
.animate-scroll {
  animation: scroll-down 1.3s linear infinite forwards;
}
</style>
