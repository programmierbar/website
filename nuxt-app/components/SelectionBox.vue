<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
    content: string
    isSelected: boolean
    selectionAnimation: 'wiggle-grow' | 'grow'
    disableRandomAnimations?: boolean // New prop to disable random animations
}>()

const animationClass = ref('')
const selectionClass = ref('')

const animations = ['animate-spin', 'animate-wiggle', 'animate-shake', 'animate-tada', 'animate-jello']

function triggerRandomAnimation() {
    if (!props.disableRandomAnimations && !props.isSelected && Math.random() < 0.2) {
        animationClass.value = animations[Math.floor(Math.random() * animations.length)]
        setTimeout(() => {
            animationClass.value = ''
        }, 1000)
    }
}

function getRandomInterval() {
    return Math.floor(Math.random() * 3000) + 3000
}

let intervalId: number | null = null

onMounted(() => {
    if (!props.disableRandomAnimations) {
        const checkAnimation = () => {
            triggerRandomAnimation()
            intervalId = window.setTimeout(checkAnimation, getRandomInterval())
        }
        intervalId = window.setTimeout(checkAnimation, getRandomInterval())
    }
})

onUnmounted(() => {
    if (intervalId !== null) {
        clearTimeout(intervalId)
    }
})

watch(
    () => props.isSelected,
    (newValue) => {
        if (newValue) {
            selectionClass.value = `animate-selection-${props.selectionAnimation}`
            setTimeout(() => {
                selectionClass.value = ''
            }, 600)
        }
    }
)
</script>

<template>
    <div
        class="emoji flex items-center justify-center rounded-lg transition-all duration-200 ease-in-out"
        :class="{ 'border-2 border-lime-500': isSelected, 'border-1 border-white': !isSelected }"
        :style="{ '--rotate-deg': '12deg' }"
    >
        <span :class="['box-content', animationClass, selectionClass]">{{ content }}</span>
    </div>
</template>

<style scoped>
:root {
    --rotate-deg: 12deg;
}

.box-content {
    display: inline-block;
}

@keyframes wiggle {
    0%,
    100% {
        transform: rotate(calc(-1 * var(--rotate-deg)));
    }
    50% {
        transform: rotate(var(--rotate-deg));
    }
}

@keyframes shake {
    0%,
    100% {
        transform: translateX(0);
    }
    25% {
        transform: translateX(-5px);
    }
    75% {
        transform: translateX(5px);
    }
}

@keyframes tada {
    0% {
        transform: scale(1);
    }
    10%,
    20% {
        transform: scale(0.9) rotate(calc(-1 * var(--rotate-deg)));
    }
    30%,
    50%,
    70%,
    90% {
        transform: scale(1.1) rotate(var(--rotate-deg));
    }
    40%,
    60%,
    80% {
        transform: scale(1.1) rotate(calc(-1 * var(--rotate-deg)));
    }
    100% {
        transform: scale(1) rotate(0);
    }
}

@keyframes jello {
    0%,
    11.1%,
    100% {
        transform: none;
    }
    22.2% {
        transform: skewX(-12.5deg) skewY(-12.5deg);
    }
    33.3% {
        transform: skewX(6.25deg) skewY(6.25deg);
    }
    44.4% {
        transform: skewX(-3.125deg) skewY(-3.125deg);
    }
    55.5% {
        transform: skewX(1.5625deg) skewY(1.5625deg);
    }
    66.6% {
        transform: skewX(-0.78125deg) skewY(-0.78125deg);
    }
    77.7% {
        transform: skewX(0.390625deg) skewY(0.390625deg);
    }
    88.8% {
        transform: skewX(-0.1953125deg) skewY(-0.1953125deg);
    }
}

@keyframes selection {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.2);
    }
    100% {
        transform: scale(1);
    }
}

.animate-wiggle {
    animation: wiggle 1s ease-in-out;
}

.animate-shake {
    animation: shake 1s ease-in-out;
}

.animate-tada {
    animation: tada 1s ease-in-out;
}

.animate-jello {
    animation: jello 1s ease-in-out;
}

.animate-selection-wiggle-grow {
    animation:
        selection 0.6s ease-in-out,
        wiggle 0.3s ease-in-out;
}

.animate-selection-grow {
    animation: selection 0.6s ease-in-out;
}
</style>
