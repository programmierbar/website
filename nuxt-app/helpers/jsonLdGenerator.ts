import { JsonLD } from 'nuxt-jsonld/dist/types/index.d';
import { DIRECTUS_CMS_URL } from '~/config';
import { FileItem, MemberItem, PodcastItem, SpeakerItem } from '~/types';
import { getPodcastType } from 'shared-code';

function generateImageUrl(image?: FileItem): string{
  if (!image) return "";
  return `${DIRECTUS_CMS_URL}/assets/${image.id}`;
}

function generatePodcastUrl(podcast: PodcastItem): string{
  return `${DIRECTUS_CMS_URL}/podcast/${podcast.slug}`;
}

function generatePersonFromSpeaker(speaker?: SpeakerItem): JsonLD|null {
  if (!speaker) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    givenName	: speaker.first_name,
    familyName: speaker.last_name,
    jobTitle : speaker.occupation,
    image: generateImageUrl(speaker.profile_image),
    sameAs : [
      speaker.twitter_url,
      speaker.linkedin_url,
      speaker.instagram_url,
      speaker.github_url,
      speaker.youtube_url,
      speaker.website_url,
    ].filter((url) => (url && url.length > 0)),
  };
}

function generatePersonFromMember(member?: MemberItem): JsonLD|null {
  if (!member) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    givenName	: member.first_name,
    familyName: member.last_name,
    jobTitle : member.occupation,
    image: generateImageUrl(member.normal_image),
  };
}

function generateCreativeWorkSeries(): JsonLD {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWorkSeries',
    name: "programmier.bar",
    url: "https://programmier.bar",
    mainEntityOfPage: "https://programmier.bar",
    sameAs: [
      "https://twitter.com/programmierbar",
      "https://www.linkedin.com/company/programmier-bar",
      "https://www.instagram.com/programmier.bar/",
    ],
  }
}

function generatePodcastEpisodeFromPodcast(podcast?: PodcastItem): JsonLD|null {
  if (!podcast) return null;

  const type = getPodcastType(podcast);

  const podcastEpisode = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: podcast.title,
    partOfSeries: generateCreativeWorkSeries(),
    image: generateImageUrl(podcast.cover_image),
    description: podcast.description,
    datePublished: podcast.published_on,
    episodeNumber: `${type} ${podcast.number}`,
    url: generatePodcastUrl(podcast),
    creator: null,
  };


  let creators = [];
  if (podcast.speakers && podcast.speakers.length > 0) {
    const speakers= podcast.speakers.map(generatePersonFromSpeaker);
    creators = [...creators, ...speakers];
  }
  if (podcast.members && podcast.members.length > 0) {
    const members= podcast.members.map(generatePersonFromMember);
    creators = [...creators, ...members];
  }
  podcastEpisode.creator = creators;

  console.log(podcast.members);

  return podcastEpisode;
}

export {
  generatePersonFromSpeaker,
  generatePodcastEpisodeFromPodcast,
  generateCreativeWorkSeries
}
