import { computed } from '@vue/composition-api';
import { StrapiImage } from 'shared-code';
import { getImageSrcSet } from '../helpers';

/**
 * Composables that creates the string for
 * the srcset attribute of an <img> Element.
 *
 * @param strapiImage A Strapi image object.
 *
 * @returns A string for the srcset attribute of an <img> element.
 */
export function useImageSrcSet(strapiImage: StrapiImage | null | undefined) {
  return computed(() => getImageSrcSet(strapiImage));
}
