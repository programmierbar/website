import { reactive, Ref } from '@nuxtjs/composition-api';
import { useEventListener } from '.';

/**
 * Composables to add parallax effects when
 * moving the mouse over an element.
 *
 * @param target The target element.
 *
 * @returns The current parallax state.
 */
export function useMotionParallax(target: Ref<HTMLElement | undefined | null>) {
  const motionParallax = reactive({ roll: 0, tilt: 0, isActive: false });

  const updatePosition = (event: MouseEvent) => {
    if (target.value) {
      const { offsetX, offsetY } = event;
      const { clientWidth, clientHeight } = target.value;
      motionParallax.tilt = (offsetX - clientWidth / 2) / clientWidth;
      motionParallax.roll = (offsetY - clientHeight / 2) / clientHeight;
    }
  };

  useEventListener(target, 'mousemove', updatePosition);

  useEventListener(target, 'mouseenter', () => {
    motionParallax.isActive = true;
  });

  useEventListener(target, 'mouseleave', () => {
    motionParallax.isActive = false;
  });

  return motionParallax;
}
