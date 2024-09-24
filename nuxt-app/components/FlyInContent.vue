<script setup lang="ts">
import { onMounted, ref } from 'vue'

const visible = ref(false)
const positionStyle = ref({
    top: '0px',
    left: '0px',
})

const showDurationMillis = 10000
const hideDurationMillis = 30_000

function positionRandomlyInView() {
    // Ensure that the vertical position is between 20% and 60% of the screen height (so that it won't be out of sight)
    const minTop = window.innerHeight * 0.2
    const maxTop = window.innerHeight * 0.6
    const top = Math.floor(Math.random() * (maxTop - minTop) + minTop) + 'px'

    // Ensure that the horizontal position is between 50% and 60% of the screen width (right side of screen)
    const minLeft = window.innerWidth * 0.5
    const maxLeft = window.innerWidth * 0.6
    const left = Math.floor(Math.random() * (maxLeft - minLeft) + minLeft) + 'px'

    positionStyle.value = { top, left }
}

function showComponent() {
    visible.value = true
    positionRandomlyInView()
    setTimeout(hideComponent, showDurationMillis)
}

function hideComponent() {
    visible.value = false
    startTimer()
}

function startTimer() {
    setTimeout(showComponent, hideDurationMillis)
}

onMounted(() => {
    positionRandomlyInView()
    showComponent()
})
</script>

<template>
    <transition name="fly">
        <div v-if="visible" class="fixed z-50" data-cursor-hover :style="positionStyle">
            <slot></slot>
        </div>
    </transition>
</template>

<style scoped>
.fly-enter-active {
    animation: flutter-in 3s ease-in-out forwards;
}

.fly-leave-active {
    animation: flutter-out 2s ease-in-out forwards;
}

@keyframes flutter-in {
    0% {
        transform: translateX(120vw) translateY(-10px) rotate(10deg);
    }
    20% {
        transform: translateX(80vw) translateY(10px) rotate(-10deg);
    }
    40% {
        transform: translateX(60vw) translateY(-10px) rotate(10deg);
    }
    60% {
        transform: translateX(40vw) translateY(10px) rotate(-10deg);
    }
    80% {
        transform: translateX(20vw) translateY(-10px) rotate(5deg);
    }
    100% {
        transform: translateX(0) translateY(0) rotate(0deg);
    }
}

@keyframes flutter-out {
    0% {
        transform: translateX(0) translateY(0) rotate(0deg);
    }
    10% {
        transform: translateX(-10vw) translateY(-10px) rotate(10deg);
    }
    20% {
        transform: translateX(-20vw) translateY(10px) rotate(-10deg);
    }
    30% {
        transform: translateX(-30vw) translateY(-10px) rotate(15deg);
    }
    40% {
        transform: translateX(-40vw) translateY(10px) rotate(-15deg);
    }
    50% {
        transform: translateX(-50vw) translateY(-10px) rotate(10deg);
    }
    60% {
        transform: translateX(-60vw) translateY(10px) rotate(-10deg);
    }
    70% {
        transform: translateX(-70vw) translateY(-10px) rotate(5deg);
    }
    80% {
        transform: translateX(-80vw) translateY(10px) rotate(-5deg);
    }
    90% {
        transform: translateX(-100vw) translateY(-10px) rotate(0deg);
    }
    100% {
        transform: translateX(-120vw) translateY(0) rotate(-5deg);
    }
}
</style>
