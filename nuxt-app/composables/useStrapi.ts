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

export function useStrapi(route: 'members'): Ref<StrapiMember[] | null>;
export function useStrapi(
  route: 'members',
  param?: Ref<`/${string}`>
): Ref<StrapiMember | null>;
export function useStrapi(route: 'speakers'): Ref<StrapiSpeaker[] | null>;
export function useStrapi(
  route: 'speakers',
  param: Ref<`?_limit=${number}`>
): Ref<StrapiSpeaker[] | null>;
export function useStrapi(
  route: 'speakers',
  param?: Ref<`/${string}`>
): Ref<StrapiSpeaker | null>;
export function useStrapi(route: 'podcasts'): Ref<StrapiPodcast[] | null>;
export function useStrapi(
  route: 'podcasts',
  param: Ref<`?${string}&_sort=published_at:DESC` | `?_limit=${number}`>
): Ref<StrapiPodcast[] | null>;
export function useStrapi(
  route: 'podcasts',
  param: Ref<`/${string}`>
): Ref<StrapiPodcast | null>;
export function useStrapi(route: 'meetups'): Ref<StrapiMeetup[] | null>;
export function useStrapi(
  route: 'meetups',
  param: Ref<`?_limit=${number}`>
): Ref<StrapiMeetup[] | null>;
export function useStrapi(
  route: 'meetups',
  param: Ref<`/${string}`>
): Ref<StrapiMeetup | null>;
export function useStrapi(
  route: 'picks-of-the-day'
): Ref<StrapiPickOfTheDay[] | null>;
export function useStrapi(
  route: 'picks-of-the-day',
  param: Ref<`?_limit=${number}`>
): Ref<StrapiPickOfTheDay[] | null>;
export function useStrapi(route: 'home-page'): Ref<StrapiHomePage | null>;
export function useStrapi(route: 'about-page'): Ref<StrapiAboutPage | null>;
export function useStrapi(route: 'podcast-page'): Ref<StrapiPodcastPage | null>;
export function useStrapi(route: 'meetup-page'): Ref<StrapiMeetupPage | null>;
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
