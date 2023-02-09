import { onMounted, ref } from 'vue';

/**
 * Composable for secure access of the document object.
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
