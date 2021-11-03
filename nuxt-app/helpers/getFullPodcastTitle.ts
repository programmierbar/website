import { StrapiPodcast } from 'shared-code';
import { getPodcastTypeAndNumber } from './getPodcastTypeAndNumber';
import { getPodcastTitleDivider } from './getPodcastTitleDivider';

/**
 * A helper function that returns the
 * full title of the podcast episode.
 *
 * @param podcast A Podcast from our CMS.
 *
 * @returns The full podcast episode title.
 */
export function getFullPodcastTitle(podcast: StrapiPodcast) {
  return (
    getPodcastTypeAndNumber(podcast) +
    getPodcastTitleDivider(podcast) +
    podcast.title
  );
}
