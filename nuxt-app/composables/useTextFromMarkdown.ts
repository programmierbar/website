import { computed } from '@nuxtjs/composition-api';
import removeMarkdown from 'remove-markdown';

/**
 * Composable that returns the plain text from markdown code.
 *
 * @param markdown The markdown code.
 *
 * @returns The plain text.
 */
export function useTextFromMarkdown(markdown: string) {
  return computed(() => removeMarkdown(markdown));
}
