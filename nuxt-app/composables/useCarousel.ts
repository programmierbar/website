import { reactive, ref } from '@nuxtjs/composition-api';

/**
 * Composable that provide the state and functions for a carousel.
 *
 * @param initialIndex The initial active index.
 *
 * @returns State and functions for a carousel.
 */
export function useCarousel(initialIndex?: number) {
  const activeIndex = ref(initialIndex || 0);

  /**
   * It changes the current active podcast index.
   *
   * @param nextIndex The next active index.
   */
  const changeActiveIndex = (nextIndex: number) => {
    activeIndex.value = nextIndex;
  };

  return reactive({
    activeIndex,
    changeActiveIndex,
  });
}
