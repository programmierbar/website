<template>
  <div class="relative">
    <!-- Podcast list -->
    <div
      ref="scrollBoxElement"
      class="
        scroll-box
        flex
        overflow-x-auto
        before:w-6
        md:before:w-48
        3xl:before:w-8
        before:flex-shrink-0
        after:w-6
        lg:after:w-8
        after:flex-shrink-0
      "
    >
      <LazyList
        class="flex"
        :items="podcasts"
        direction="horizontal"
        :scroll-element="scrollBoxElement"
      >
        <template #default="{ item, index }">
          <li
            :key="item.id"
            :class="
              index > 0 &&
              'ml-10 md:ml-16 lg:ml-20 xl:ml-24 2xl:md-28 3xl:ml-32'
            "
          >
            <PodcastCard :podcast="item" />
          </li>
        </template>
      </LazyList>
    </div>

    <!-- Scroll buttons -->
    <button
      v-for="index of 2"
      :key="index"
      class="
        hidden
        md:block md:w-40
        3xl:w-80
        md:h-full
        md:absolute
        md:top-0
        md:from-black
        md:to-transparent
        md:transition-opacity
        md:duration-200
      "
      :class="[
        index === 1
          ? 'md:left-0 md:bg-gradient-to-r'
          : 'md:right-0 md:bg-gradient-to-l',
        ((index === 1 && scrollStartReached) ||
          (index === 2 && scrollEndReached)) &&
          'invisible opacity-0 pointer-events-none',
      ]"
      :style="
        ((index === 1 && scrollStartReached) ||
          (index === 2 && scrollEndReached) ||
          undefined) &&
        'transition: visibility 0s .2s, opacity .2s'
      "
      type="button"
      :title="index === 1 ? 'Scroll left' : 'Scroll right'"
      :data-cursor-arrow-left="index === 1 && !scrollStartReached"
      :data-cursor-arrow-right="index === 2 && !scrollEndReached"
      @click="() => scrollTo(index === 1 ? 'left' : 'right')"
    />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  PropType,
  ref,
} from '@nuxtjs/composition-api';
import smoothscroll from 'smoothscroll-polyfill';
import { StrapiPodcast } from 'shared-code';
import { useEventListener } from '../composables';
import LazyList from './LazyList.vue';
import PodcastCard from './PodcastCard.vue';

export default defineComponent({
  components: {
    LazyList,
    PodcastCard,
  },
  props: {
    podcasts: {
      type: Array as PropType<StrapiPodcast[]>,
      required: true,
    },
  },
  setup() {
    // Create scroll box element reference
    const scrollBoxElement = ref<HTMLDivElement>();

    // Create scroll start and end reached reference
    const scrollStartReached = ref(true);
    const scrollEndReached = ref(true);

    /**
     * It programmatically scrolls the slider
     * a little to the left or right.
     */
    const scrollTo = (direction: 'left' | 'right') => {
      const { innerWidth } = window;
      const { scrollLeft } = scrollBoxElement.value!;
      scrollBoxElement.value!.scrollTo({
        left: scrollLeft + innerWidth * 0.4 * (direction === 'left' ? -1 : 1),
        behavior: 'smooth',
      });
    };

    // Add smooth scroll polyfill
    onMounted(smoothscroll.polyfill);

    /**
     * It detects whether the start or the end of the scrolling area
     * has been reached, depending on the scrolling position.
     */
    const handleScrollState = () => {
      const { innerWidth } = window;
      const { scrollLeft, scrollWidth } = scrollBoxElement.value!;
      scrollStartReached.value = scrollLeft === 0;
      scrollEndReached.value = scrollLeft === scrollWidth - innerWidth;
    };

    // Update scroll state on mounted
    onMounted(handleScrollState);

    // Add scroll event listener to scroll box element
    useEventListener(scrollBoxElement, 'scroll', handleScrollState);

    // Create mouse position variable
    let mousePosition: number | null = null;

    /**
     * Handles the scroll position of the scroll box element.
     */
    const handleScrollPosition = () => {
      // Change scroll position on mouse movement
      const handleScrollMove = (event: MouseEvent) => {
        if (mousePosition) {
          scrollBoxElement.value!.scrollLeft += mousePosition - event.clientX;
          scrollBoxElement.value!.style.pointerEvents = 'none';
        }
        mousePosition = event.clientX;
      };
      window.addEventListener('mousemove', handleScrollMove);

      // Reset mouse position and remove event listeners
      const handleScrollStop = () => {
        window.removeEventListener('mousemove', handleScrollMove);
        window.removeEventListener('mouseup', handleScrollStop, true);
        scrollBoxElement.value!.style.pointerEvents = '';
        mousePosition = null;
      };
      window.addEventListener('mouseup', handleScrollStop, true);
    };

    // Add mouse down event listener to scroll box element
    useEventListener(scrollBoxElement, 'mousedown', handleScrollPosition);

    return {
      scrollBoxElement,
      scrollStartReached,
      scrollEndReached,
      scrollTo,
    };
  },
});
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
