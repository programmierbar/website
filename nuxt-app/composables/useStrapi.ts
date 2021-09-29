/* eslint-disable no-redeclare */
import { computed, Ref, useStatic } from '@nuxtjs/composition-api';
import {
  StrapiAboutPage,
  StrapiHomePage,
  StrapiMeetup,
  StrapiMeetupPage,
  StrapiMember,
  StrapiPickOfTheDay,
  StrapiPodcast,
  StrapiPodcastPage,
  StrapiSpeaker,
} from 'shared-code';
import { getHashCode } from '../helpers';

export function useStrapi(route: 'members'): Ref<StrapiMember[]>;
export function useStrapi(
  route: 'members',
  param?: Ref<`/${string}`>
): Ref<StrapiMember | null>;
export function useStrapi(route: 'speakers'): Ref<StrapiSpeaker[]>;
export function useStrapi(
  route: 'speakers',
  param: Ref<`?_limit=${number}`>
): Ref<StrapiSpeaker[]>;
export function useStrapi(
  route: 'speakers',
  param?: Ref<`/${string}`>
): Ref<StrapiSpeaker | null>;
export function useStrapi(route: 'podcasts'): Ref<StrapiPodcast[]>;
export function useStrapi(
  route: 'podcasts',
  param: Ref<`?${string}&_sort=published_at:DESC` | `?_limit=${number}`>
): Ref<StrapiPodcast[]>;
export function useStrapi(
  route: 'podcasts',
  param: Ref<`/${string}`>
): Ref<StrapiPodcast | null>;
export function useStrapi(route: 'meetups'): Ref<StrapiMeetup[]>;
export function useStrapi(
  route: 'meetups',
  param: Ref<`?_limit=${number}`>
): Ref<StrapiMeetup[]>;
export function useStrapi(
  route: 'meetups',
  param: Ref<`/${string}`>
): Ref<StrapiMeetup | null>;
export function useStrapi(route: 'picks-of-the-day'): Ref<StrapiPickOfTheDay[]>;
export function useStrapi(
  route: 'picks-of-the-day',
  param: Ref<`?_limit=${number}`>
): Ref<StrapiPickOfTheDay[]>;
export function useStrapi(route: 'home-page'): Ref<StrapiHomePage>;
export function useStrapi(route: 'about-page'): Ref<StrapiAboutPage>;
export function useStrapi(route: 'podcast-page'): Ref<StrapiPodcastPage>;
export function useStrapi(route: 'meetup-page'): Ref<StrapiMeetupPage>;
export function useStrapi(route: string, param?: Ref<string>) {
  const hashCode = computed(() =>
    param?.value ? `${getHashCode(param.value)}` : 'list'
  );
  return useStatic(
    async () => {
      try {
        const response = await fetch(
          `${process.env.NUXT_ENV_STRAPI_CMS}/${route}${param?.value || ''}`
        );
        const data = await response.json();
        if (process.env.NUXT_ENV_STRAPI_CMS?.includes('http://localhost')) {
          return JSON.parse(
            JSON.stringify(data).replace(
              /"url":"\/uploads\//g,
              `"url":"${process.env.NUXT_ENV_STRAPI_CMS}/uploads/`
            )
          );
        }
        return data;
      } catch {
        return null;
      }
    },
    hashCode,
    route
  );
}
