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
      ? {
          title:
            page.value.meta_title +
            (route.value.path !== '/' ? ' | programmier.bar' : ''),
          meta: [
            {
              hid: 'description',
              name: 'description',
              content: page.value.meta_description,
            },
          ],
        }
      : {}
  );
}
