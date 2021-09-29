import { onMounted, ref } from '@nuxtjs/composition-api';

/**
 * Composables for secure access of the document object.
 *
 * @returns A reference to the document object.
 */
export function useBodyElement() {
  const bodyElement = ref<HTMLElement>();

  onMounted(() => {
    bodyElement.value = document.body;
  });

  return bodyElement;
}
