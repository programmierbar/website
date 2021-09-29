<template>
  <div class="relative overflow-hidden">
    <!-- Slide list -->
    <ul
      ref="carouselElement"
      class="flex items-start space-x-12"
      :class="
        isMoving ? 'pointer-events-none' : 'transition-transform duration-500'
      "
    >
      <slot />
    </ul>

    <!-- Overlay gradient -->
    <div
      v-for="index of 2"
      :key="index"
      class="
        md:w-64
        lg:w-80
        xl:w-96
        md:h-full md:absolute md:top-0 md:from-black md:to-transparent
        pointer-events-none
      "
      :class="
        index === 1
          ? 'md:left-0 md:bg-gradient-to-r'
          : 'md:right-0 md:bg-gradient-to-l'
      "
    />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  reactive,
  ref,
  watch,
  toRefs,
} from '@nuxtjs/composition-api';
import { useEventListener, useWindow } from '../composables';

interface MousePosition {
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
}

interface EventTypes {
  start: 'touchstart' | 'mousedown';
  move: 'touchmove' | 'mousemove';
  stop: 'touchend' | 'mouseup';
}

interface EventPosition {
  clientX: number;
  clientY: number;
}

export default defineComponent({
  props: {
    activeIndex: {
      type: Number,
      required: true,
    },
  },
  setup(props, { emit }) {
    // Create carousel element and state reference
    const carouselElement = ref<HTMLUListElement>();
    const carouselState = reactive({ isMoving: false });

    /**
     * Center the active slide in the middle of the screen.
     */
    const centerActiveSlide = () => {
      if (carouselElement.value) {
        const slideElement = carouselElement.value.children[props.activeIndex];
        const { left: parentLeft, width: parentWidth } =
          carouselElement.value.getBoundingClientRect();
        const { left: childLeft, width: childWidth } =
          slideElement.getBoundingClientRect();
        carouselElement.value.style.transform = `translateX(${
          parentLeft - (childLeft + childWidth / 2 - parentWidth / 2)
        }px)`;
      }
    };

    // Center active slide when component has been mounted
    onMounted(centerActiveSlide);

    // Center active slide when window sizes changes
    useEventListener(useWindow(), 'resize', centerActiveSlide);

    // Center active slide if active index has
    // changed and carousel is not moving
    watch(
      () => props.activeIndex,
      (newIndex, prevIndex) => {
        if (newIndex !== prevIndex && !carouselState.isMoving) {
          centerActiveSlide();
        }
      }
    );

    /**
     * Handels the touch or mouse start event of the window object
     * when the user starts dragging the carousel slides.
     */
    const handleStartEvent = (isTouch: boolean) => {
      // Create mouse and scroll position variable
      let mousePosition: MousePosition | null = null;
      let scrollPosition =
        carouselElement.value!.getBoundingClientRect().left -
        carouselElement.value!.parentElement!.getBoundingClientRect().left;

      // Create event types object
      const eventTypes: EventTypes = isTouch
        ? {
            start: 'touchstart',
            move: 'touchmove',
            stop: 'touchend',
          }
        : {
            start: 'mousedown',
            move: 'mousemove',
            stop: 'mouseup',
          };

      /**
       * Handels the touch or mouse move event of the window
       * object when the user drags the carousel slides.
       */
      const handleMoveEvent = (event: TouchEvent | MouseEvent) => {
        event.preventDefault();

        // Get current event position
        const eventPosition: EventPosition = isTouch
          ? {
              clientX: (event as TouchEvent).targetTouches[0].clientX,
              clientY: (event as TouchEvent).targetTouches[0].clientY,
            }
          : {
              clientX: (event as MouseEvent).clientX,
              clientY: (event as MouseEvent).clientY,
            };

        // Calculate scroll position and update view
        if (mousePosition) {
          scrollPosition -= mousePosition.clientX - eventPosition.clientX;
          carouselElement.value!.style.transform = `translateX(${scrollPosition}px)`;

          // Activate scroll mode when the user has scrolled
          if (
            Math.abs(mousePosition.startX - mousePosition.clientX) > 2 ||
            Math.abs(mousePosition.startY - mousePosition.clientY) > 2
          ) {
            carouselState.isMoving = true;
          }
        }

        // Update mouse position
        mousePosition = {
          clientX: eventPosition.clientX,
          clientY: eventPosition.clientY,
          startX: mousePosition?.startX ?? eventPosition.clientX,
          startY: mousePosition?.startY ?? eventPosition.clientY,
        };

        // Get new active index
        let smallestDiff = Infinity;
        let newActiveIndex = -1;
        carouselElement
          .value!.querySelectorAll('li')
          .forEach((slideElement, index) => {
            const { left, width } = slideElement.getBoundingClientRect();
            const currentDiff = Math.abs(
              window.innerWidth / 2 - (left + width / 2)
            );
            if (currentDiff < smallestDiff) {
              smallestDiff = currentDiff;
              newActiveIndex = index;
            }
          });

        // Update active index if necessary
        if (newActiveIndex >= 0 && newActiveIndex !== props.activeIndex) {
          emit('active-index-change', newActiveIndex);
        }
      };

      /**
       * Handles the touch end or mouse up event of the window
       * object when the user stops dragging the carousel slides.
       */
      const handleStopEvent = (event: MouseEvent | TouchEvent) => {
        // Disable on click events on child elements when scrolled
        if (carouselState.isMoving) {
          event.stopPropagation();
        }

        // Disable scrolling mode and reset mouse position
        carouselState.isMoving = false;
        mousePosition = null;

        // Remove move and stop event listeners
        window.removeEventListener(eventTypes.move, handleMoveEvent);
        window.removeEventListener('click', handleStopEvent, true);

        // Center active slide
        centerActiveSlide();
      };

      // Add move and stop event listener
      window.addEventListener(eventTypes.move, handleMoveEvent, {
        passive: false,
      });
      window.addEventListener(eventTypes.stop, handleStopEvent, true);
    };

    // Add event listener that moves carousel slides when user starts dragging
    useEventListener(carouselElement, 'touchstart', () =>
      handleStartEvent(true)
    );
    useEventListener(carouselElement, 'mousedown', () =>
      handleStartEvent(false)
    );

    // Return carousel element and state
    return { carouselElement, ...toRefs(carouselState) };
  },
});
</script>
