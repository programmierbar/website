<template>
  <div class="relative flex justify-center">
    <div
      class="
        w-8
        lg:w-12
        h-16
        lg:h-24
        absolute
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
    >
      <div class="animate-scroll w-1.5 lg:w-2 h-4 lg:h-6 bg-lime origin-top" />
    </div>
  </div>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api';

export default defineComponent({});
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
