<template>
  <div class="mouse-cursor pointer-events-none">
    <div
      ref="mainCursorElement"
      class="
        w-8
        h-8
        fixed
        z-70
        -left-4
        -top-4
        flex
        items-center
        justify-center
        before:w-8
        before:h-8
        before:fixed
        before:block
        before:border-2
        before:rounded-full
        before:transition-all
      "
      :class="[
        !cursorMode || cursorMode === 'none'
          ? 'before:opacity-0'
          : 'before:opacity-100',
        cursorMode === 'default' && 'before:bg-lime before:border-lime',
        cursorMode === 'black' && 'before:bg-black before:border-black',
        cursorMode &&
          ['hover', 'more', 'arrow-left', 'arrow-right'].includes(cursorMode) &&
          'before:bg-pink before:bg-opacity-0 before:border-pink',
        cursorMode &&
          ['hover', 'hover-blue', 'arrow-left', 'arrow-right'].includes(
            cursorMode
          ) &&
          'before:scale-200',
        cursorMode === 'hover-blue' &&
          'before:bg-blue before:bg-opacity-0 before:border-blue',
        cursorMode === 'more' && 'before:scale-250',
      ]"
    >
      <span
        v-if="cursorMode === 'more'"
        class="relative top-px text-blue text-sm font-black uppercase"
      >
        Mehr
      </span>
      <div
        v-if="cursorMode === 'arrow-left'"
        class="h-8 relative -left-12 text-blue"
        v-html="require('~/assets/icons/angle-left.svg?raw')"
      />
      <div
        v-if="cursorMode === 'arrow-right'"
        class="h-8 relative left-12 text-blue"
        v-html="require('~/assets/icons/angle-right.svg?raw')"
      />
    </div>
    <div
      ref="delayedDotElement"
      class="w-2 h-2 fixed z-70 -top-1 -left-1 rounded-full"
      :class="[
        cursorMode === 'black' ? 'bg-black' : 'bg-lime',
        (!cursorMode ||
          [
            'none',
            'hover',
            'hover-blue',
            'more',
            'arrow-left',
            'arrow-right',
          ].includes(cursorMode)) &&
          'opacity-0',
      ]"
      :style="`transition: transform 0.1s linear, opacity 0.1s linear ${
        cursorMode === 'default' ? 0.5 : 0
      }s`"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from '@nuxtjs/composition-api';
import { useEventListener, useWindow } from '../composables';

type CursorMode =
  | 'default'
  | 'none'
  | 'black'
  | 'hover'
  | 'hover-blue'
  | 'more'
  | 'arrow-left'
  | 'arrow-right';

const cursorModes: CursorMode[] = [
  'none',
  'black',
  'hover',
  'hover-blue',
  'more',
  'arrow-left',
  'arrow-right',
];

export default defineComponent({
  setup() {
    // Create element and state references
    const mainCursorElement = ref<HTMLDivElement>();
    const delayedDotElement = ref<HTMLDivElement>();

    // Create cursor mode references
    const cursorMode = ref<CursorMode>();

    /**
     * It handels the movement, visibility and mode of the mouse cursor.
     */
    const handleMouseCursor = (event: MouseEvent) => {
      if (window.matchMedia('(pointer: fine)').matches) {
        // Move mouse cursor based on mouse move event
        const transform = `translate(${event.clientX}px, ${event.clientY}px)`;
        mainCursorElement.value!.style.transform = transform;
        delayedDotElement.value!.style.transform = transform;

        // Set cursor mode based on nodes of composed path
        cursorMode.value =
          event
            .composedPath()
            .reduce<CursorMode | false | undefined>(
              (cursorMode, currentNode) =>
                cursorMode ||
                (currentNode instanceof HTMLElement &&
                  cursorModes.find((cursorMode) =>
                    currentNode.hasAttribute(`data-cursor-${cursorMode}`)
                  )),
              undefined
            ) || 'default';
      }
    };

    // Add mouse move event listener
    useEventListener(useWindow(), 'mousemove', handleMouseCursor);

    return {
      mainCursorElement,
      delayedDotElement,
      cursorMode,
    };
  },
});
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
