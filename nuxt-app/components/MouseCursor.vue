<template>
    <div class="mouse-cursor pointer-events-none">
        <div
            ref="mainCursorElement"
            class="fixed -left-4 -top-4 z-70 flex h-8 w-8 items-center justify-center before:fixed before:block before:h-8 before:w-8 before:rounded-full before:border-2 before:transition-all"
            :class="[
                !cursorMode || cursorMode === 'none' ? 'before:opacity-0' : 'before:opacity-100',
                cursorMode === 'default' && 'before:border-lime before:bg-lime',
                cursorMode === 'black' && 'before:border-black before:bg-black',
                cursorMode &&
                    ['hover', 'more', 'arrow-left', 'arrow-right'].includes(cursorMode) &&
                    'before:border-pink before:bg-pink before:bg-opacity-0',
                cursorMode &&
                    ['hover', 'hover-blue', 'arrow-left', 'arrow-right'].includes(cursorMode) &&
                    'before:scale-200',
                cursorMode === 'hover-blue' && 'before:border-blue before:bg-blue before:bg-opacity-0',
                cursorMode === 'more' && 'before:scale-250',
            ]"
        >
            <span v-if="cursorMode === 'more'" class="relative top-px text-sm font-black uppercase text-blue">
                Mehr
            </span>
            <AngleLeftIcon v-if="cursorMode === 'arrow-left'" class="relative -left-12 h-8 text-blue" />
            <AngleRightIcon v-if="cursorMode === 'arrow-right'" class="relative left-12 h-8 text-blue" />
        </div>
        <div
            ref="delayedDotElement"
            class="fixed -left-1 -top-1 z-70 h-2 w-2 rounded-full"
            :class="[
                cursorMode === 'black' ? 'bg-black' : 'bg-lime',
                (!cursorMode ||
                    ['none', 'hover', 'hover-blue', 'more', 'arrow-left', 'arrow-right'].includes(cursorMode)) &&
                    'opacity-0',
            ]"
            :style="`transition: transform 0.1s linear, opacity 0.1s linear ${cursorMode === 'default' ? 0.5 : 0}s`"
        />
    </div>
</template>

<script setup lang="ts">
import AngleLeftIcon from '~/assets/icons/angle-left.svg'
import AngleRightIcon from '~/assets/icons/angle-right.svg'
import { ref } from 'vue'
import { useEventListener, useWindow } from '../composables'

type CursorMode = 'default' | 'none' | 'black' | 'hover' | 'hover-blue' | 'more' | 'arrow-left' | 'arrow-right'

const cursorModes: CursorMode[] = ['none', 'black', 'hover', 'hover-blue', 'more', 'arrow-left', 'arrow-right']
// Create element and state references
const mainCursorElement = ref<HTMLDivElement>()
const delayedDotElement = ref<HTMLDivElement>()

// Create cursor mode references
const cursorMode = ref<CursorMode>()

/**
 * It handels the movement, visibility and mode of the mouse cursor.
 */
const handleMouseCursor = (event: MouseEvent) => {
    if (window.matchMedia('(pointer: fine)').matches) {
        // Move mouse cursor based on mouse move event
        const transform = `translate(${event.clientX}px, ${event.clientY}px)`
        mainCursorElement.value!.style.transform = transform
        delayedDotElement.value!.style.transform = transform

        // Set cursor mode based on nodes of composed path
        cursorMode.value =
            event
                .composedPath()
                .reduce<
                    CursorMode | false | undefined
                >((cursorMode, currentNode) => cursorMode || (currentNode instanceof HTMLElement && cursorModes.find((cursorMode) => currentNode.hasAttribute(`data-cursor-${cursorMode}`))), undefined) ||
            'default'
    }
}

// Add mouse move event listener
useEventListener(useWindow(), 'mousemove', handleMouseCursor)
</script>

<style scoped>
.mouse-cursor {
    display: none;
}
@media (pointer: fine) {
    .mouse-cursor {
        display: block;
    }
}
</style>

<style>
@media (pointer: fine) {
    * {
        cursor: none !important;
    }
    body {
        min-height: 100vh;
    }
}
</style>
