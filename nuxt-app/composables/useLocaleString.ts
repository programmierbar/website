import type { Ref } from 'vue';
import { computed } from 'vue';

/**
 * Composable that converts a number to a local string.
 *
 * @param ref The value reference.
 *
 * @returns The local string.
 */
export function useLocaleString(ref: Ref<number | undefined>) {
  return computed(() => ref.value?.toLocaleString('de-DE') || null);
}
