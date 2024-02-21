<template>
  <NuxtLink
    class="link-button inline-flex items-center space-x-4 md:space-x-5 lg:space-x-6 text-sm md:text-lg lg:text-xl text-white hover:text-blue font-black uppercase tracking-widest transition-colors"
    :to="href"
    data-cursor-hover
  >
    <!-- Text -->
    <div class="pt-1"><slot /></div>

    <!-- Arrows -->
    <div class="relative">
      <div
        v-for="count of 3"
        :key="count"
        class="angle-right h-4 md:h-5 lg:h-6"
        :class="[
          count > 1 && 'absolute top-0 opacity-0',
          count === 2 && 'left-3 md:left-4',
          count === 3 && 'left-6 md:left-8',
        ]"
        :style="`animation-delay: ${count * 150 - 300}ms`"
        v-html="angleRightIcon"
      />
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import angleRightIcon from '~/assets/icons/angle-right.svg?raw';
const props = defineProps<{
  href: string;
}>();
const { href } = toRefs(props);
</script>

<style lang="postcss" scoped>
@keyframes fade-in {
  0% {
    opacity: 0;
  }
  25% {
    opacity: 1;
  }
  80% {
    opacity: 0;
  }
  100% {
    opacity: 0;
  }
}
.link-button:hover .angle-right {
  animation: fade-in 0.8s ease infinite forwards;
}
</style>
