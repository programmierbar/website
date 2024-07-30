<script setup lang="ts">
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
            'btn btn-primary rounded-full border-4 text-base font-bold leading-8 tracking-[2px] text-lime hover:bg-lime hover:text-black active:translate-y-1 ',
            isClicked ? 'animate-grow-fade' : '',
        ]"
        @click="handleClick"
    >
        <slot />
    </button>
</template>

<style scoped lang="postcss">
@keyframes grow-fade {
    0% {
        box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7);
    }
    100% {
        box-shadow: 0 0 20px 20px rgba(0, 255, 0, 0);
    }
}

.animate-grow-fade {
    animation: grow-fade 0.3s ease-out;
}
</style>
