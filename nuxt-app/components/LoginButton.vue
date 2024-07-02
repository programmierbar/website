<script setup lang="ts">
import { ref } from 'vue'

const isClicked = ref(false)

const handleClick = () => {
    isClicked.value = true
    setTimeout(() => {
        isClicked.value = false
    }, 300) // Duration of the animation
}
</script>

<template>
    <button
        :class="[
            'btn btn-primary rounded-full bg-gray-900 bg-opacity-50 text-base font-light italic leading-8 tracking-wide text-white hover:bg-white hover:text-gray-900 lg:text-2xl',
            isClicked ? 'animate-grow-fade' : '',
        ]"
        @click="handleClick"
    >
        <NuxtLink to="/login"> Einloggen </NuxtLink>
    </button>
</template>

<style scoped lang="postcss">
@keyframes grow-fade {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
    }
    100% {
        box-shadow: 0 0 20px 20px rgba(255, 255, 255, 0);
    }
}

.animate-grow-fade {
    animation: grow-fade 0.3s ease-out;
}
</style>
