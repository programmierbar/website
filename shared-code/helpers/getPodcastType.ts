interface Podcast {
  type: string;
}

/**
 * A helper function that converts the podcast type to a readable string.
 *
 * @param podcast A podcast object.
 *
 * @returns The podcast type.
 */
export function getPodcastType(podcast: Podcast) {
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
