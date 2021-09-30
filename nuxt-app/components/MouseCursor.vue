<template>
  <div class="hidden md:block" :class="isVisible ? 'visible' : 'invisible'">
    <div
      ref="mainCursorElement"
      class="
        w-8
        h-8
        fixed
        z-50
        -left-4
        -top-4
        flex
        items-center
        justify-center
        pointer-events-none
        before:w-8
        before:h-8
        before:fixed
        before:block
        before:border-2
        before:rounded-full
        before:transition-all
      "
      :class="[
        cursorMode === 'default' && 'before:bg-lime before:border-lime',
        cursorMode === 'none' ? 'before:opacity-0' : 'before:opacity-100',
        cursorMode === 'black' && 'before:bg-black before:border-black',
        ['hover', 'more', 'arrow-left', 'arrow-right'].includes(cursorMode) &&
          'before:bg-pink before:bg-opacity-0 before:border-pink',
        ['hover', 'hover-blue', 'arrow-left', 'arrow-right'].includes(
          cursorMode
        ) && 'before:scale-200',
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
      class="
        w-2
        h-2
        fixed
        z-50
        -top-1
        -left-1
        rounded-full
        pointer-events-none
        ease-linear
        duration-100
      "
      :class="[
        cursorMode === 'black' ? 'bg-black' : 'bg-lime',
        [
          'none',
          'hover',
          'hover-blue',
          'more',
          'arrow-left',
          'arrow-right',
        ].includes(cursorMode) && 'opacity-0',
      ]"
    />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  reactive,
  ref,
  toRefs,
  useRoute,
  watch,
} from '@nuxtjs/composition-api';
import {
  useBodyElement,
  useEventListener,
  useMutationObserver,
  useWindow,
} from '../composables';

type CursorMode =
  | 'default'
  | 'none'
  | 'black'
  | 'hover'
  | 'hover-blue'
  | 'more'
  | 'arrow-left'
  | 'arrow-right';

interface MouseCursorState {
  cursorMode: CursorMode;
  isVisible: boolean;
}

interface ActiveEventListener {
  target: Element;
  type: string;
  listener: EventListener;
}

export default defineComponent({
  setup() {
    // Create element and state references
    const mainCursorElement = ref<HTMLDivElement>();
    const delayedDotElement = ref<HTMLDivElement>();
    const mouseCursorState = reactive<MouseCursorState>({
      cursorMode: 'default',
      isVisible: false,
    });

    /**
     * It moves the custom mouse cursor based on the mouse move event object.
     */
    const moveMouseCursor = (event: MouseEvent) => {
      const transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      mainCursorElement.value!.style.transform = transform;
      delayedDotElement.value!.style.transform = transform;
      mouseCursorState.isVisible = true;
    };

    // Add mouse move event listener to move custom mouse cursor
    useEventListener(useWindow(), 'mousemove', moveMouseCursor);

    // Create list with all cursor modes
    const allCursorModes: CursorMode[] = [
      'default',
      'none',
      'black',
      'hover',
      'hover-blue',
      'more',
      'arrow-left',
      'arrow-right',
    ];

    // Create cursor mode chain
    const cursorModeChain: CursorMode[] = ['default'];

    // Create list for active event listeners
    const activeEventListeners: ActiveEventListener[] = [];

    /**
     * It adds event listeners for the individual cursor modes
     * that are required to update the current cursor mode.
     */
    const addEventListeners = () => {
      allCursorModes.forEach((cursorMode) => {
        document
          .querySelectorAll(`[data-cursor-${cursorMode}]`)
          .forEach((element) => {
            // Create add listeners function
            const addListeners = () => {
              // Create remove mode listener function
              const removeModeListener = () => {
                // Remove this listener on first call
                element.removeEventListener('mouseleave', removeModeListener);

                // Check if the chain has not been reset
                if (cursorModeChain.length > 1) {
                  // Remove current cursor mode from chain (last index)
                  cursorModeChain.pop();

                  // Change back to the previous cursor mode
                  mouseCursorState.cursorMode =
                    cursorModeChain[cursorModeChain.length - 1];
                }

                // Add listeners to current element again
                addListeners();
              };

              // Create add mode listener function
              const addModeListener = () => {
                // Remove this listener on first call
                element.removeEventListener('mousemove', addModeListener);

                // Set cursor mode and add it to chain
                mouseCursorState.cursorMode = cursorMode;
                cursorModeChain.push(cursorMode);

                // Add remove mode listener and add it to active event listeners
                element.addEventListener('mouseleave', removeModeListener);
              };

              // Add add mode listener and add it to active event listeners
              element.addEventListener('mousemove', addModeListener);
              activeEventListeners.push({
                target: element,
                type: 'mousemove',
                listener: addModeListener,
              });
            };

            // Add listeners to current element
            addListeners();
          });
      });
    };

    /**
     * It removes the all added event listeners for the individual cursor modes.
     */
    const removeEventListeners = () => {
      activeEventListeners.forEach(({ target, type, listener }) =>
        target.removeEventListener(type, listener)
      );
      activeEventListeners.length = 0;
    };

    // Reset cursor mode and cursor mode chain when route changes
    const route = useRoute();
    watch(
      () => route.value.path,
      () => {
        mouseCursorState.cursorMode = 'default';
        cursorModeChain.length = 0;
        cursorModeChain.push('default');
      }
    );

    // Add event listeners for individual cusor modes
    onMounted(addEventListeners);

    // Add mutation observer that updates event listener for individual
    // cursor modes when cursor mode attributes changes
    useMutationObserver(
      useBodyElement(),
      () => {
        removeEventListeners();
        addEventListeners();
      },
      {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: allCursorModes.map(
          (cursorMode) => `data-cursor-${cursorMode}`
        ),
      }
    );

    return {
      mainCursorElement,
      delayedDotElement,
      ...toRefs(mouseCursorState),
    };
  },
});
</script>

<style>
@media (min-width: 768px) {
  * {
    cursor: none !important;
  }
}
body {
  min-height: 100vh;
}
</style>
