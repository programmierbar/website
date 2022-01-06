interface Podcast {
  type: string;
}

/**
 * A helper function that returns the title divider based on the podcast type.
 *
 * @param podcast A podcast object.
 *
 * @returns The podcast title divider.
 */
export function getPodcastTitleDivider(podcast: Podcast) {
  switch (podcast.type) {
    case 'deep_dive':
      return ' – ';
    case 'cto_special':
    case 'news':
    default:
      return ': ';
  }
}
