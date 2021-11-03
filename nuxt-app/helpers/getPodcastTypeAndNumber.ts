import { StrapiPodcast } from 'shared-code';
import { getPodcastTypeString } from './getPodcastTypeString';

/**
 * A helper function that returns the type and number
 * of the podcast episode in a readable string.
 *
 * @param podcast A Podcast from our CMS.
 *
 * @returns The type and number of the podcast episode.
 */
export function getPodcastTypeAndNumber(podcast: StrapiPodcast) {
  return getPodcastTypeString(podcast) + ' ' + podcast.number;
}
