import { onMounted, ref } from '@nuxtjs/composition-api';

/**
 * Composable for secure access of the document object.
 *
 * @returns A reference to the document object.
 */
export function useDocument() {
  const _document = ref<Document>();

  onMounted(() => {
    _document.value = document;
  });

  return _document;
}
