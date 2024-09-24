<script setup lang="ts">
import { onMounted, ref } from 'vue'

const visible = ref(false)
const positionStyle = ref({
    bottom: '0px',
    left: '0px',
})

const showDurationMillis = 10000
const hideDurationMillis = 30_000

function positionRandomlyInView() {
    const bottom = `${Math.floor(Math.random() * (window.innerHeight * 0.1) + window.innerHeight * 0.1)}px`
    const left = `${Math.floor(Math.random() * (window.innerWidth * 0.2) + window.innerWidth * 0.2)}px`

    positionStyle.value = { bottom, left }
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
    animation: flutter-out 4s ease-in-out forwards;
}

@keyframes flutter-in {
    0% {
        transform: translateY(120vh) rotate(10deg);
    }
    20% {
        transform: translateY(80vh) rotate(-10deg);
    }
    40% {
        transform: translateY(60vh) rotate(10deg);
    }
    60% {
        transform: translateY(40vh) rotate(-10deg);
    }
    80% {
        transform: translateY(20vh) rotate(5deg);
    }
    100% {
        transform: translateY(0) rotate(0deg);
    }
}

@keyframes flutter-out {
    0% {
        transform: translateY(0) rotate(0deg);
    }
    10% {
        transform: translateY(-10vh) translateX(-5vw) rotate(-10deg);
    }
    20% {
        transform: translateY(0) translateX(-2vw) rotate(10deg);
    }
    30% {
        transform: translateY(-15vh) translateX(5vw) rotate(15deg);
    }
    40% {
        transform: translateY(-5vh) translateX(2vw) rotate(-5deg);
    }
    50% {
        transform: translateY(-25vh) translateX(0vw) rotate(5deg);
    }
    60% {
        transform: translateY(-40vh) rotate(-5deg);
    }
    70% {
        transform: translateY(-60vh) rotate(0deg);
    }
    80% {
        transform: translateY(-80vh) rotate(0deg);
    }
    90% {
        transform: translateY(-100vh) rotate(0deg);
    }
    100% {
        transform: translateY(-120vh) rotate(-5deg);
    }
}
</style>
