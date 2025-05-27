<template>
    <div class="relative">
        <!-- Scroll box -->
        <div
            ref="scrollBoxElement"
            class="scroll-box flex items-center overflow-x-auto overflow-y-hidden"
            @mousedown="changeScrollPosition"
            @scroll="detectScrollState"
        >
            <GenericLazyList class="flex" :items="speakers" direction="horizontal" :scroll-element="scrollBoxElement">
                <template #default="{ item, index, viewportItems, addViewportItem }">
                    <GenericListItem
                        :key="item.id"
                        :class="index > 0 && 'ml-5 md:ml-8 lg:ml-10'"
                        :item="item"
                        :viewport-items="viewportItems"
                        :add-viewport-item="addViewportItem"
                    >
                        <template #default="{ isNewToViewport }">
                            <FadeAnimation :fade-in="isNewToViewport ? 'from_bottom' : 'none'" :threshold="0">
                                <ConferenceSpeaker :speaker="item" />
                            </FadeAnimation>
                        </template>
                    </GenericListItem>
                </template>
            </GenericLazyList>
        </div>

        <!-- Scroll buttons -->
        <button
            v-for="index of 2"
            :key="index"
            class="hidden md:absolute md:top-0 md:block md:h-full md:w-40 md:from-black md:to-transparent md:transition-opacity md:duration-500 3xl:w-80"
            :class="[
                index === 1 ? 'md:left-0 md:bg-gradient-to-r' : 'md:right-0 md:bg-gradient-to-l',
                ((index === 1 && scrollStartReached) || (index === 2 && scrollEndReached)) &&
                    'pointer-events-none invisible opacity-0',
            ]"
            :style="
                ((index === 1 && scrollStartReached) || (index === 2 && scrollEndReached) || undefined) &&
                'transition: visibility 0s .2s, opacity .2s'
            "
            type="button"
            :title="index === 1 ? 'Scroll left' : 'Scroll right'"
            :data-cursor-arrow-left="(index === 1 && !scrollStartReached) ? true : null"
            :data-cursor-arrow-right="(index === 2 && !scrollEndReached) ? true : null"
            @click="() => scrollTo(index === 1 ? 'left' : 'right')"
        />
    </div>
</template>

<script setup lang="ts">
import { CLICK_SCROLL_LEFT_ARROW_EVENT_ID, CLICK_SCROLL_RIGHT_ARROW_EVENT_ID } from '~/config'
import { trackGoal } from '~/helpers'
import type { SpeakerPreviewItem } from '~/types';
import smoothscroll from 'smoothscroll-polyfill'
import { onMounted, ref } from 'vue'
import FadeAnimation from './FadeAnimation.vue'
import GenericLazyList from './GenericLazyList.vue'
import GenericListItem from './GenericListItem.vue'

defineProps<{
  speakers: SpeakerPreviewItem[]
}>()

// Create scroll box element reference
const scrollBoxElement = ref<HTMLDivElement>()

// Create scroll start and end reached reference
const scrollStartReached = ref(true)
const scrollEndReached = ref(true)

// Add smooth scroll polyfill
onMounted(smoothscroll.polyfill)

/**
 * It detects whether the start or the end of the scrolling area
 * has been reached, depending on the scrolling position.
 */
const detectScrollState = () => {
    const { innerWidth } = window
    const { scrollLeft, scrollWidth } = scrollBoxElement.value!
    scrollStartReached.value = scrollLeft < 64
    scrollEndReached.value = scrollLeft > scrollWidth - innerWidth - 64
}

// Update scroll state on mounted
onMounted(detectScrollState)

/**
 * It programmatically scrolls the slider
 * a little to the left or right.
 */
const scrollTo = (direction: 'left' | 'right') => {
    if (direction === 'left') {
        trackGoal(CLICK_SCROLL_LEFT_ARROW_EVENT_ID)
    } else {
        trackGoal(CLICK_SCROLL_RIGHT_ARROW_EVENT_ID)
    }
    const { innerWidth } = window
    const { scrollLeft } = scrollBoxElement.value!
    scrollBoxElement.value!.scrollTo({
        left: scrollLeft + innerWidth * 0.4 * (direction === 'left' ? -1 : 1),
        behavior: 'smooth',
    })
}

/**
 * It changes the scroll position of the scroll box
 * element when the user drags its content.
 */
const changeScrollPosition = () => {
    // Create last client X variable
    let lastClientX: number

    /**
     * It changes the scroll position when the mouse
     * moves and disables pointer events.
     *
     * @param event Mouse event object.
     */
    const handleScrollMove = (event: MouseEvent) => {
        if (lastClientX) {
            scrollBoxElement.value!.scrollLeft += lastClientX - event.clientX
        } else {
            scrollBoxElement.value!.style.pointerEvents = 'none'
            scrollBoxElement.value!.style.userSelect = 'none'
        }
        lastClientX = event.clientX
    }

    /**
     * It removes the event listener and resets the style attribute.
     */
    const handleScrollStop = () => {
        window.removeEventListener('mousemove', handleScrollMove)
        window.removeEventListener('mouseup', handleScrollStop, true)
        scrollBoxElement.value!.style.pointerEvents = ''
        scrollBoxElement.value!.style.userSelect = ''
    }

    // Add mousemove and mouseup event listener
    window.addEventListener('mousemove', handleScrollMove)
    window.addEventListener('mouseup', handleScrollStop, true)
}
</script>

<style lang="postcss" scoped>
.scroll-box {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.scroll-box::-webkit-scrollbar {
    @apply hidden;
}
@media (min-width: 1536px) {
    .scroll-box::before {
        width: calc((100vw - 1536px) / 2 + 12rem);
    }
    .scroll-box::after {
        width: calc((100vw - 1536px) / 2 + 2rem);
    }
}
@media (min-width: 2000px) {
    .scroll-box::before {
        width: calc((100vw - 1536px) / 2 + 2rem);
    }
}
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
.podcast-link:hover .angle-right {
    animation: fade-in 0.8s ease infinite forwards;
}
</style>
