<template>
  <div class="relative">
    <!-- Scroll box -->
    <div
      ref="scrollBoxElement"
      class="
        scroll-box
        flex
        items-center
        overflow-x-auto overflow-y-hidden
        before:w-6
        md:before:w-48
        3xl:before:w-8
        before:flex-shrink-0
        after:w-6
        lg:after:w-8
        after:flex-shrink-0
      "
    >
      <!-- Podcast list -->
      <LazyList
        class="flex"
        :items="podcasts"
        direction="horizontal"
        :scroll-element="scrollBoxElement"
      >
        <template #default="{ item, index, viewportItems, addViewportItem }">
          <LazyListItem
            :key="item.id"
            :class="
              index > 0 &&
              'ml-10 md:ml-16 lg:ml-20 xl:ml-24 2xl:ml-28 3xl:ml-32'
            "
            :item="item"
            :viewport-items="viewportItems"
            :add-viewport-item="addViewportItem"
          >
            <template #default="{ isNewToViewport }">
              <FadeAnimation
                :fade-in="isNewToViewport ? 'from_bottom' : 'none'"
                :threshold="0"
              >
                <PodcastCard :podcast="item" />
              </FadeAnimation>
            </template>
          </LazyListItem>
        </template>
      </LazyList>

      <!-- Podcast link -->
      <div
        v-if="showPodcastLink"
        class="
          flex
          items-end
          border-b-4
          md:border-b-5
          lg:border-b-6
          border-lime
          pl-3
          lg:pl-6
          pr-5
          lg:pr-10
          ml-10
          md:ml-16
          lg:ml-20
          xl:ml-24
          2xl:ml-28
          3xl:ml-32
          mb-14
          md:mb-32
        "
      >
        <div
          class="h-40 md:h-48 lg:h-60 relative -bottom-1 lg:-bottom-1.5"
          v-html="require('../assets/images/podcast-figure.svg?raw')"
        />
        <NuxtLink
          class="
            podcast-link
            flex
            items-end
            space-x-4
            md:space-x-5
            lg:space-x-6
            text-sm
            md:text-lg
            lg:text-xl
            text-white
            hover:text-blue
            font-black
            uppercase
            whitespace-nowrap
            tracking-widest
            leading-relaxed
            md:leading-relaxed
            lg:leading-relaxed
            transition-colors
            pb-2
          "
          to="/podcast"
          data-cursor-hover
        >
          <div>
            Alle {{ podcastCount }}<br />
            Folgen
          </div>
          <div class="relative mb-1 lg:mb-2">
            <div
              v-for="count of 3"
              :key="count"
              class="angle-right h-4 md:h-5 lg:h-6"
              :class="[
                count > 1 && 'absolute top-0 opacity-0',
                count === 2 && 'left-3 md:left-4',
                count === 3 && 'left-6 md:left-8',
              ]"
              :style="`animation-delay: ${count * 150 - 300}ms`"
              v-html="require('../assets/icons/angle-right.svg?raw')"
            />
          </div>
        </NuxtLink>
      </div>
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
        md:duration-500
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
import { useStrapi, useEventListener } from '../composables';
import { trackGoal } from '../helpers';
import FadeAnimation from './FadeAnimation.vue';
import LazyList from './LazyList.vue';
import LazyListItem from './LazyListItem.vue';
import PodcastCard from './PodcastCard.vue';

export default defineComponent({
  components: {
    FadeAnimation,
    LazyList,
    LazyListItem,
    PodcastCard,
  },
  props: {
    podcasts: {
      type: Array as PropType<StrapiPodcast[]>,
      required: true,
    },
    showPodcastLink: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    // Query Strapi podcast count
    const podcastCount = useStrapi('podcasts', '/count');

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
      if (direction === 'left') {
        trackGoal(process.env.NUXT_ENV_CLICK_SCROLL_LEFT_ARROW_EVENT!);
      } else {
        trackGoal(process.env.NUXT_ENV_CLICK_SCROLL_RIGHT_ARROW_EVENT!);
      }
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
      scrollStartReached.value = scrollLeft < 64;
      scrollEndReached.value = scrollLeft > scrollWidth - innerWidth - 64;
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
      podcastCount,
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
