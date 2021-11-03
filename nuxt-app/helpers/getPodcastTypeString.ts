import { StrapiPodcast } from 'shared-code';

/**
 * A helper function that converts the podcast
 * type from our CMS to a readable string.
 *
 * @param podcast A Podcast from our CMS.
 *
 * @returns A readable podcast type string.
 */
export function getPodcastTypeString(podcast: StrapiPodcast) {
  switch (podcast.type) {
    case 'deep_dive':
      return 'Deep Dive';
    case 'cto_special':
      return 'CTO-Special';
    case 'news':
      return 'News';
    default:
      return 'Spezialfolge';
  }
}
