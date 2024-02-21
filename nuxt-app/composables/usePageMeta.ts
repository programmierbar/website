import type { Ref } from 'vue';
import { getMetaInfo } from '../helpers';
import type { FileItem } from '../types';
import { useRoute, useHead } from '#app';

interface PageMeta {
  meta_title: string;
  meta_description: string;
  cover_image?: FileItem;
}

/**
 * Composable to set the meta data of a page.
 *
 * @param page A page from our CMS.
 */
export function usePageMeta(page: Ref<PageMeta | null | undefined>) {
  const route = useRoute();
  useHead(() =>
    page.value
      ? getMetaInfo({
          type: 'website',
          path: route.path,
          title: page.value.meta_title,
          description: page.value.meta_description,
          image: page.value.cover_image,
        })
      : {}
  );
}
