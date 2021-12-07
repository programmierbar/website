import { useMeta, useRoute, Ref } from '@nuxtjs/composition-api';
import {
  StrapiHomePage,
  StrapiAboutPage,
  StrapiMeetupPage,
  StrapiPodcastPage,
  StrapiContactPage,
  StrapiHallOfFamePage,
  StrapiPickOfTheDayPage,
} from 'shared-code';
import { getMetaInfo } from '../helpers';

/**
 * Composable to set the meta data of a page.
 *
 * @param page A page from our CMS.
 */
export function usePageMeta(
  page: Ref<
    | StrapiHomePage
    | StrapiAboutPage
    | StrapiMeetupPage
    | StrapiPodcastPage
    | StrapiContactPage
    | StrapiHallOfFamePage
    | StrapiPickOfTheDayPage
    | null
  >
) {
  const route = useRoute();
  useMeta(() =>
    page.value
      ? getMetaInfo({
          type: 'website',
          path: route.value.path,
          title: page.value.meta_title,
          description: page.value.meta_description,
          image:
            'cover_image' in page.value ? page.value.cover_image : undefined,
        })
      : {}
  );
}
