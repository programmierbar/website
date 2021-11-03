import { StrapiPodcast } from 'shared-code';

/**
 * A helper function that returns the title divider based on the podcast type.
 *
 * @param podcast A Podcast from our CMS.
 *
 * @returns The divider as a string.
 */
export function getPodcastTitleDivider(podcast: StrapiPodcast) {
  switch (podcast.type) {
    case 'deep_dive':
      return ' – ';
    case 'cto_special':
    case 'news':
    default:
      return ': ';
  }
}
