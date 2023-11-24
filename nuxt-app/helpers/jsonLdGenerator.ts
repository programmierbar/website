import { JsonLD } from 'nuxt-jsonld/dist/types/index.d';
import { Person, PodcastEpisode, PodcastSeries, WithContext } from 'schema-dts';
import { DIRECTUS_CMS_URL, BUZZSPROUT_RSS_FEED_URL } from '~/config';
import { FileItem, MemberItem, PodcastItem, SpeakerItem } from '~/types';
import { getPodcastType } from 'shared-code';

function generateImageUrl(image?: FileItem): string {
  if (!image) return '';
  return `${DIRECTUS_CMS_URL}/assets/${image.id}`;
}

function generatePodcastUrl(podcast: PodcastItem): string {
  return `${DIRECTUS_CMS_URL}/podcast/${podcast.slug}`;
}

function generatePersonFromSpeaker(speaker: SpeakerItem): WithContext<Person> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    givenName: speaker.first_name,
    familyName: speaker.last_name,
    jobTitle: speaker.occupation,
    image: generateImageUrl(speaker.profile_image),
    sameAs: [
      speaker.twitter_url,
      speaker.linkedin_url,
      speaker.instagram_url,
      speaker.github_url,
      speaker.youtube_url,
      speaker.website_url,
    ].filter((url) => url && url.length > 0) as string[],
  };
}

function generatePersonFromMember(member: MemberItem): WithContext<Person> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    givenName: member.first_name,
    familyName: member.last_name,
    jobTitle: member.occupation,
    image: generateImageUrl(member.normal_image),
  };
}

function generatePodcastSeries(): WithContext<PodcastSeries> {
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: 'programmier.bar',
    url: 'https://programmier.bar',
    mainEntityOfPage: 'https://programmier.bar',
    webFeed: BUZZSPROUT_RSS_FEED_URL,
    sameAs: [
      'https://twitter.com/programmierbar',
      'https://www.linkedin.com/company/programmier-bar',
      'https://www.instagram.com/programmier.bar/',
    ],
  };
}

function generatePodcastEpisodeFromPodcast(
  podcast?: PodcastItem
): JsonLD | null {
  if (!podcast) return null;

  const type = getPodcastType(podcast);

  const creator: Person[] = [
    ...(podcast.speakers ?? []).map(generatePersonFromSpeaker),
    ...(podcast.members ?? []).map(generatePersonFromMember),
  ];

  const partOfSeries = generatePodcastSeries();

  const podcastEpisode: WithContext<PodcastEpisode> = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: podcast.title,
    partOfSeries: partOfSeries ?? undefined,
    image: generateImageUrl(podcast.cover_image),
    description: podcast.description,
    datePublished: podcast.published_on,
    episodeNumber: `${type} ${podcast.number}`,
    url: generatePodcastUrl(podcast),
    ...(creator && { creator }),
  };

  return podcastEpisode;
}

export {
  generatePersonFromSpeaker,
  generatePodcastEpisodeFromPodcast,
  generatePodcastSeries,
};
