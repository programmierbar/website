<template>
    <div class="relative">
        <!-- Scroll box -->
        <div
            ref="scrollBoxElement"
            class="scroll-box flex items-center overflow-x-auto overflow-y-hidden"
            @mousedown="changeScrollPosition"
            @scroll="detectScrollState"
        >
            <ClientOnly>
                <GenericLazyList
                    class="flex"
                    :items="randomizedTestimonials"
                    direction="horizontal"
                    :scroll-element="scrollBoxElement"
                >
                    <template #default="{ item, index, viewportItems, addViewportItem }">
                        <GenericListItem
                            :key="item.id"
                            :class="index > 0 && 'ml-12 ml-16 lg:ml-20 xl:ml-24 2xl:ml-32'"
                            :item="item"
                            :viewport-items="viewportItems"
                            :add-viewport-item="addViewportItem"
                        >
                            <template #default="{ isNewToViewport }">
                                <FadeAnimation :fade-in="isNewToViewport ? 'from_bottom' : 'none'" :threshold="0">
                                    <div class="w-60 md:w-120">
                                        <div>
                                            <blockquote class="w-full">
                                                <QuoteStart class="mb-2 mb-5 origin-bottom-left scale-100 scale-50" />
                                                <InnerHtml
                                                    :html="item.text"
                                                    class="text-3xl text-xl font-light italic text-white"
                                                />
                                                <div class="flex justify-end">
                                                    <QuoteEnd class="-mt-1 block scale-100 scale-50" />
                                                </div>
                                            </blockquote>
                                            <p class="mt-10 mt-4 text-base font-light italic text-white opacity-40">
                                                {{ item.subtitle }}
                                            </p>
                                        </div>
                                    </div>
                                </FadeAnimation>
                            </template>
                        </GenericListItem>
                    </template>
                </GenericLazyList>
            </ClientOnly>
        </div>

        <!-- Scroll buttons -->
        <button
            v-for="index of 2"
            :key="index"
            class="absolute top-0 block h-full w-5 from-black to-transparent transition-opacity duration-500 md:w-40 3xl:w-80"
            :class="[
                index === 1 ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l',
                ((index === 1 && scrollStartReached) || (index === 2 && scrollEndReached)) &&
                    'pointer-events-none invisible opacity-0',
            ]"
            :style="
                ((index === 1 && scrollStartReached) || (index === 2 && scrollEndReached) || undefined) &&
                'transition: visibility 0s .2s, opacity .2s'
            "
            type="button"
            :title="index === 1 ? 'Scroll left' : 'Scroll right'"
            :data-cursor-arrow-left="index === 1 && !scrollStartReached ? true : null"
            :data-cursor-arrow-right="index === 2 && !scrollEndReached ? true : null"
            @click="() => scrollTo(index === 1 ? 'left' : 'right')"
        />
    </div>
</template>

<script setup lang="ts">
import QuoteEnd from '~/assets/icons/quote-end.svg'
import QuoteStart from '~/assets/icons/quote-start.svg'
import { useWeightedRandomSelection } from '~/composables/useWeightedRandomSelection'
import { CLICK_SCROLL_LEFT_ARROW_EVENT_ID, CLICK_SCROLL_RIGHT_ARROW_EVENT_ID } from '~/config'
import { trackGoal } from '~/helpers'
import type { DirectusTestimonialItem, SpeakerPreviewItem } from '~/types'
import smoothscroll from 'smoothscroll-polyfill'
import { onMounted, ref } from 'vue'
import FadeAnimation from './FadeAnimation.vue'
import GenericLazyList from './GenericLazyList.vue'
import GenericListItem from './GenericListItem.vue'

const props = defineProps<{
    testimonials: DirectusTestimonialItem[]
}>()

const { selectTestimonials } = useWeightedRandomSelection()
const randomizedTestimonials = computed(() => selectTestimonials(props.testimonials, 5))

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
</style>
