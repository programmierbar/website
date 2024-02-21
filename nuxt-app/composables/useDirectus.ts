import { type Collections, directus } from '~/services';
import { type Query, readItems, readSingleton } from '@directus/sdk';
import type { DirectusHomePage, DirectusPodcastItem } from '~/types';

export type LatestPodcasts = Pick<
  DirectusPodcastItem,
  | 'id'
  | 'slug'
  | 'published_on'
  | 'type'
  | 'number'
  | 'title'
  | 'cover_image'
  | 'audio_url'
>[];

export function useDirectus() {
  async function getHomepage(
    query_object: Query<Collections, DirectusHomePage>
  ) {
    return await directus.request(readSingleton('home_page', query_object));
  }

  async function getLatestPodcasts() {
    return await directus.request(
      readItems('podcasts', {
        fields: [
          'id',
          'slug',
          'published_on',
          'type',
          'number',
          'title',
          'cover_image',
          'audio_url',
        ],
        sort: ['-published_on'],
        limit: 10,
      })
    );
  }

  return { getHomepage, getLatestPodcasts };
}
