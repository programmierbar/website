<template>
    <transition
        appear
        enter-class="screen-enter"
        leave-active-class="transition-opacity duration-300 delay-200 ease-linear"
        leave-to-class="opacity-0 screen-leave-to"
        :duration="{ enter: 3000, leave: 500 }"
    >
        <div v-if="isLoading" class="fixed left-0 top-0 z-30 h-screen w-screen bg-black">
            <div class="loading-bar h-1 w-full origin-left scale-x-75 bg-lime transition-transform duration-3000" />
        </div>
    </transition>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useLoadingScreen } from '../composables'

export default defineComponent({
    setup() {
        return useLoadingScreen()
    },
})
</script>

<style lang="postcss" scoped>
.screen-enter .loading-bar {
    @apply scale-x-0;
}
.screen-leave-to .loading-bar {
    @apply scale-x-100 duration-500;
}
</style>
