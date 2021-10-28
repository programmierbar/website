import { computed, Ref } from '@nuxtjs/composition-api';

/**
 * Composable that converts a number to a local string.
 *
 * @param ref The value reference.
 *
 * @returns The local string.
 */
export function useLocaleString(ref: Ref<number | null>) {
  return computed(() => ref.value?.toLocaleString('de-DE') || null);
}
