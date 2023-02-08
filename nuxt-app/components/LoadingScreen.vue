<template>
  <transition
    appear
    enter-class="screen-enter"
    leave-active-class="transition-opacity duration-300 delay-200 ease-linear"
    leave-to-class="opacity-0 screen-leave-to"
    :duration="{ enter: 3000, leave: 500 }"
  >
    <div
      v-if="isLoading"
      class="w-screen h-screen fixed z-30 top-0 left-0 bg-black"
    >
      <div
        class="loading-bar w-full h-1 bg-lime scale-x-75 origin-left transition-transform duration-3000"
      />
    </div>
  </transition>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useLoadingScreen } from '../composables';

export default defineComponent({
  setup() {
    return useLoadingScreen();
  },
});
</script>

<style lang="postcss" scoped>
.screen-enter .loading-bar {
  @apply scale-x-0;
}
.screen-leave-to .loading-bar {
  @apply scale-x-100 duration-500;
}
</style>
