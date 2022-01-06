import { getPodcastTypeAndNumber } from './getPodcastTypeAndNumber';
import { getPodcastTitleDivider } from './getPodcastTitleDivider';

interface Podcast {
  type: string;
  number: string;
  title: string;
}

/**
 * A helper function that returns the full title of a podcast episode.
 *
 * @param podcast A podcast object.
 *
 * @returns The full podcast episode title.
 */
export function getFullPodcastTitle(podcast: Podcast) {
  return (
    getPodcastTypeAndNumber(podcast) +
    getPodcastTitleDivider(podcast) +
    podcast.title
  );
}
