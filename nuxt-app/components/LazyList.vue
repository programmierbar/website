<template>
  <ul ref="lazyListElement" :style="style">
    <slot
      v-for="(renderItem, index) in renderItems"
      :item="renderItem"
      :index="index + firstIndex"
    />
  </ul>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  nextTick,
  PropType,
  ref,
  Ref,
  watch,
} from '@nuxtjs/composition-api';
import { useEventListener, useWindow } from '../composables';

export default defineComponent({
  props: {
    items: {
      type: Array as PropType<any[]>,
      required: true,
    },
    direction: {
      type: String as PropType<'vertical' | 'horizontal'>,
      required: true,
    },
    scrollElement: {
      type: (typeof window === 'undefined'
        ? Object
        : window.HTMLElement) as PropType<HTMLElement | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    // Create lazy list element reference
    const lazyListElement = ref<HTMLElement>();

    // Create first and last item element reference
    const firstItemElement = ref<HTMLElement>();
    const lastItemElement = ref<HTMLElement>();

    // Create first an last index reference
    const firstIndex = ref(0);
    const lastIndex = ref(Math.min(props.items.length - 1, 9));

    // Create padding start and end list reference
    const paddingStartList = ref<number[]>([]);
    const paddingEndList = ref<number[]>([]);

    // Update state when items changes
    watch(
      () => props.items,
      () => {
        firstIndex.value = Math.max(
          Math.min(props.items.length - 11, firstIndex.value),
          0
        );
        lastIndex.value = Math.max(
          Math.min(props.items.length - 1, lastIndex.value),
          Math.min(props.items.length - 1, 9),
          0
        );
        paddingStartList.value = paddingStartList.value.slice(
          0,
          firstIndex.value
        );
        paddingEndList.value = paddingEndList.value.slice(
          lastIndex.value + 1,
          props.items.length
        );
      }
    );

    // Create items to be rendered
    const renderItems = computed(() =>
      props.items.slice(firstIndex.value, lastIndex.value + 1)
    );

    // Create list style with padding start and end
    const style = computed(() => {
      const paddingStart =
        paddingStartList.value.reduce((total, size) => total + size, 0) + 'px';
      const paddingEnd =
        paddingEndList.value.reduce((total, size) => total + size, 0) + 'px';
      if (props.direction === 'vertical') {
        return {
          paddingTop: paddingStart,
          paddingBottom: paddingEnd,
        };
      }
      return {
        paddingLeft: paddingStart,
        paddingRight: paddingEnd,
      };
    });

    /**
     * It adds an element to the start or end of the list.
     */
    const addElement = (
      scrollDirection: 'up' | 'down',
      index: Ref<number>,
      paddingList: Ref<number[]>
    ) => {
      index.value += scrollDirection === 'up' ? -1 : 1;
      paddingList.value.pop();
    };

    /**
     * It removes an element from the start or end of the list.
     */
    const removeElement = (
      scrollDirection: 'up' | 'down',
      index: Ref<number>,
      itemElement: Ref<HTMLElement | undefined>,
      paddingList: Ref<number[]>
    ) => {
      // Check if item element exists
      if (itemElement.value) {
        // Destructure window and client rect object
        const { innerWidth, innerHeight } = window;
        const { height, width, top, right, bottom, left } =
          itemElement.value.getBoundingClientRect();

        // Remove item element when it is no longer in viewport
        if (
          (scrollDirection === 'up' &&
            (props.direction === 'vertical' ? top : left) >
              (props.direction === 'vertical' ? innerHeight : innerWidth)) ||
          (scrollDirection === 'down' &&
            (props.direction === 'vertical' ? bottom : right) < 0)
        ) {
          // Destructure computed style object
          const { marginTop, marginRight, marginBottom, marginLeft } =
            window.getComputedStyle(itemElement.value);

          // Add item size + margin to padding list
          paddingList.value.push(
            props.direction === 'vertical'
              ? height + parseInt(marginTop) + parseInt(marginBottom)
              : width + parseInt(marginLeft) + parseInt(marginRight)
          );

          // Remove item element from list
          index.value += scrollDirection === 'up' ? -1 : 1;
        }
      }
    };

    // Create last scroll position variable
    let lastScrollPosition = 0;

    /**
     * It adds or removes items at the start
     * or end of the list while scrolling.
     */
    const handleScroll = () => {
      // Destructure window object
      const { scrollX, scrollY, innerWidth, innerHeight } = window;
      const { scrollTop, scrollLeft } = props.scrollElement || {};

      // Detect scroll direction
      const nextScrollPosition =
        props.direction === 'vertical'
          ? scrollTop || scrollY
          : scrollLeft || scrollX;
      const scrollDirection =
        lastScrollPosition > nextScrollPosition ? 'up' : 'down';
      lastScrollPosition = nextScrollPosition;

      // Check position of first item element if user scrolls up, first
      // index is greater that 0 and first item element exists
      if (
        scrollDirection === 'up' &&
        firstIndex.value > 0 &&
        firstItemElement.value
      ) {
        // Destructure client rect of first item element
        const { bottom, right } =
          firstItemElement.value.getBoundingClientRect();

        // Add and remove element if first item element approaches viewport
        if (
          (props.direction === 'vertical' ? bottom : right) >=
          (props.direction === 'vertical' ? innerHeight : innerWidth) * -2
        ) {
          // Add element to start
          addElement(scrollDirection, firstIndex, paddingStartList);

          // Remove element from end
          removeElement(
            scrollDirection,
            lastIndex,
            lastItemElement as Ref<HTMLElement>,
            paddingEndList
          );
        }

        // Check position of last item element if user scrolls down, last
        // index is not reached and last item element exists
      } else if (
        scrollDirection === 'down' &&
        lastIndex.value < props.items.length - 1 &&
        lastItemElement.value
      ) {
        // Destructure client rect of last item element
        const { top, left } = lastItemElement.value.getBoundingClientRect();

        // Add and remove element if last item element approaches viewport
        if (
          (props.direction === 'vertical' ? top : left) <=
          (props.direction === 'vertical' ? innerHeight : innerWidth) * 3
        ) {
          // Add element to end
          addElement(scrollDirection, lastIndex, paddingEndList);

          // Remove element from start
          removeElement(
            scrollDirection,
            firstIndex,
            firstItemElement as Ref<HTMLElement>,
            paddingStartList
          );
        }
      }
    };

    // Create scroll target
    const windowRef = useWindow();
    const scrollTarget = computed(() => props.scrollElement || windowRef.value);

    // Add scroll event listener to scroll target
    useEventListener(scrollTarget as any, 'scroll', handleScroll);

    // Update first and last item element when items,
    // lazy list element, first or last index changes
    watch([() => props.items, lazyListElement, firstIndex, lastIndex], () => {
      nextTick(() => {
        firstItemElement.value = lazyListElement.value
          ?.firstElementChild as HTMLElement;
        lastItemElement.value = lazyListElement.value
          ?.lastElementChild as HTMLElement;
      });
    });

    return {
      lazyListElement,
      firstIndex,
      renderItems,
      style,
    };
  },
});
</script>
