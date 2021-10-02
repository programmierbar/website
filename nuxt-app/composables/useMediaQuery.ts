import { ref, watch } from '@nuxtjs/composition-api';
import { useEventListener } from './useEventListener';
import { useWindow } from './useWindow';

/**
 * Composable to check if a media query matches the current device.
 *
 * @param query The media query string.
 *
 * @returns Whether the media query matches.
 */
export function useMediaQuery(query: string) {
  const window = useWindow();
  const mediaQuery = ref(window.value?.matchMedia(query));
  const matches = ref(!!mediaQuery.value?.matches);

  watch(window, () => {
    mediaQuery.value = window.value?.matchMedia(query);
    matches.value = !!mediaQuery.value?.matches;
  });

  const listener = (event: MediaQueryListEvent) => {
    matches.value = event.matches;
  };

  useEventListener(mediaQuery, 'change', listener);

  return matches;
}
