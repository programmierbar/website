import { directus } from '~/services';
import { aggregate, readItems, readSingleton } from '@directus/sdk';
import type { DirectusPodcastItem } from '~/types';

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
  async function getHomepage() {
    return await directus.request(readSingleton('home_page', {
      fields: ['*', 'video.*'],
    }));
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
          'cover_image.*',
          'audio_url',
        ],
        sort: ['-published_on'],
        limit: 10,
      })
    );
  }

  async function getPodcastCount() {
    let result =  await directus.request(aggregate('podcasts', {
      aggregate: { count: '*' },
    }))

    return Number(result.pop()?.count);
  }

  return { getHomepage, getLatestPodcasts, getPodcastCount };
}
