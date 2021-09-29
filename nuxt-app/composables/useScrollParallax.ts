import { reactive, Ref } from '@nuxtjs/composition-api';
import { useEventListener, useWindow } from '.';

/**
 * Composables to add parallax effects when scrolling within an element.
 *
 * @param target The target element.
 *
 * @returns The current parallax state.
 */
export function useScrollParallax(target: Ref<HTMLElement | undefined | null>) {
  const scrollParallax = reactive({ offset: 0, isVisible: false });

  const updatePosition = () => {
    if (target.value) {
      const { innerHeight } = window;
      const { top, bottom, height } = target.value.getBoundingClientRect();
      scrollParallax.offset = innerHeight / 2 - (top + height / 2);
      scrollParallax.isVisible = bottom > 0 && top < innerHeight;
    }
  };

  useEventListener(useWindow(), 'scroll', updatePosition);

  return scrollParallax;
}
