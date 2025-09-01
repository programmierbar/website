import { getPodcastType } from './getPodcastType';

interface Podcast {
  type: string;
  number: string;
}

/**
 * A helper function that returns the type and number
 * of a podcast episode in a readable string.
 *
 * @param podcast A podcast object.
 *
 * @returns The podcast type and number.
 */
export function getPodcastTypeAndNumber(podcast: Podcast) {
  if (podcast.number !== undefined && podcast.number !== null) {
    return getPodcastType(podcast) + ' ' + podcast.number;
  }

  return getPodcastType(podcast);
}
