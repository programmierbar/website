<template>
    <div class="relative flex justify-center">
        <button
            class="absolute -top-10 z-20 hidden h-16 w-8 justify-center rounded-full border-4 border-lime md:flex lg:-top-14 lg:h-24 lg:w-12 lg:border-6"
            :class="!opacity && 'invisible'"
            :style="{ opacity }"
            type="button"
            title="Scroll down"
            data-cursor-hover
            @click="scrollDown"
        >
            <div class="animate-scroll h-4 w-1.5 origin-top bg-lime lg:h-6 lg:w-2" />
        </button>
    </div>
</template>

<script lang="ts">
import smoothscroll from 'smoothscroll-polyfill'
import { defineComponent, onMounted, ref } from 'vue'
import { useEventListener, useWindow } from '../composables'
import { CLICK_SCROLL_DOWN_MOUSE_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'

export default defineComponent({
    setup() {
        // Add opacity reference
        const opacity = ref(1)

        /**
         * It updates the opacity based on the scroll
         * position and the height of the viewport.
         */
        const handleOpacity = () => {
            const { scrollY, innerHeight } = window
            const maxHeight = innerHeight / 2
            opacity.value = (maxHeight - Math.min(scrollY, maxHeight)) / maxHeight
        }

        // Add scroll event listener to window object
        useEventListener(useWindow(), 'scroll', handleOpacity)

        /**
         * It scrolls the page down a bit.
         */
        const scrollDown = () => {
            trackGoal(CLICK_SCROLL_DOWN_MOUSE_EVENT_ID)
            const { scrollY, innerHeight } = window
            window.scrollTo({
                top: scrollY + innerHeight / 2,
                behavior: 'smooth',
            })
        }

        // Add smooth scroll polyfill
        onMounted(smoothscroll.polyfill)

        return {
            opacity,
            scrollDown,
        }
    },
})
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
