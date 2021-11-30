/* eslint-disable no-redeclare */
import {
  computed,
  Ref,
  ref,
  unref,
  useContext,
  useStatic,
  watch,
} from '@nuxtjs/composition-api';
import {
  StrapiAboutPage,
  StrapiContactPage,
  StrapiHallOfFamePage,
  StrapiHomePage,
  StrapiImprintPage,
  StrapiMeetup,
  StrapiMeetupPage,
  StrapiMember,
  StrapiPickOfTheDay,
  StrapiPickOfTheDayPage,
  StrapiPodcast,
  StrapiPodcastPage,
  StrapiPrivacyPage,
  StrapiSpeaker,
} from 'shared-code';
import { getHashCode } from '../helpers';

// Members
export function useStrapi(route: 'members'): Ref<StrapiMember[] | null>;
export function useStrapi(
  route: 'members',
  param?: Ref<`/${string}`>
): Ref<StrapiMember | null>;

// Speakers
export function useStrapi(
  route: 'speakers',
  param?: '?_limit=-1'
): Ref<StrapiSpeaker[] | null>;
export function useStrapi(
  route: 'speakers',
  param?: Ref<`/${string}`>
): Ref<StrapiSpeaker | null>;
export function useStrapi(
  route: 'speakers',
  param?: '/count'
): Ref<number | null>;

// Podcasts
export function useStrapi(
  route: 'podcasts',
  param?:
    | Ref<`?${string}&_sort=published_at:DESC` | `?_limit=${number}`>
    | '?_limit=-1'
): Ref<StrapiPodcast[] | null>;
export function useStrapi(
  route: 'podcasts',
  param: Ref<`/${string}`>
): Ref<StrapiPodcast | null>;
export function useStrapi(
  route: 'podcasts',
  param: '/count'
): Ref<number | null>;

// Meetups
export function useStrapi(
  route: 'meetups',
  param?: '?_limit=-1'
): Ref<StrapiMeetup[] | null>;
export function useStrapi(
  route: 'meetups',
  param: Ref<`/${string}`>
): Ref<StrapiMeetup | null>;
export function useStrapi(
  route: 'meetups',
  param: '/count'
): Ref<number | null>;

// Picks of the Day
export function useStrapi(
  route: 'picks-of-the-day',
  param?: '?_limit=-1'
): Ref<StrapiPickOfTheDay[] | null>;
export function useStrapi(
  route: 'picks-of-the-day',
  param: '/count'
): Ref<number | null>;

// Pages
export function useStrapi(route: 'home-page'): Ref<StrapiHomePage | null>;
export function useStrapi(route: 'podcast-page'): Ref<StrapiPodcastPage | null>;
export function useStrapi(route: 'meetup-page'): Ref<StrapiMeetupPage | null>;
export function useStrapi(
  route: 'hall-of-fame-page'
): Ref<StrapiHallOfFamePage | null>;
export function useStrapi(
  route: 'pick-of-the-day-page'
): Ref<StrapiPickOfTheDayPage | null>;
export function useStrapi(route: 'about-page'): Ref<StrapiAboutPage | null>;
export function useStrapi(route: 'contact-page'): Ref<StrapiContactPage | null>;
export function useStrapi(route: 'imprint-page'): Ref<StrapiImprintPage | null>;
export function useStrapi(route: 'privacy-page'): Ref<StrapiPrivacyPage | null>;

/**
 * Composable to fetch the website data from our Strapi CMS.
 *
 * @param route The API route.
 * @param param The API parameter.
 *
 * @returns The requested data.
 */
export function useStrapi(route: string, param?: Ref<string> | string) {
  // Add Nuxt.js context
  const context = useContext();

  // Create error reference
  const error = ref('');

  // Force error page if an error has occurred
  watch(error, () => {
    if (error.value) {
      context.error({ statusCode: 404, message: error.value });
    }
  });

  // Create hash code
  const hashCode = computed(() =>
    unref(param) ? `${getHashCode(unref(param))}` : 'list'
  );

  // Return useStatic composables
  return useStatic(
    async () => {
      // Fetch data from our Strapi CMS
      const response = await fetch(
        `${process.env.NUXT_ENV_STRAPI_CMS}/${route}${unref(param) || ''}`
      );

      // Set errors if one has occurred
      if (!response.ok) {
        error.value = await response.text();
        return null;
      }

      // Return data from our Strapi CMS
      const data = await response.json();
      return data;
    },
    hashCode,
    route
  );
}
