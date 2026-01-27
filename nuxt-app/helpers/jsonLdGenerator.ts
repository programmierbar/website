import { BUZZSPROUT_RSS_FEED_URL, DIRECTUS_CMS_URL } from '~/config'
import type { DirectusProfileItem, MemberItem, PodcastItem, SpeakerItem } from '~/types';
import type { JsonLD } from 'nuxt-jsonld/dist/types/index.d'
import type { Person, PodcastEpisode, PodcastSeries, WithContext } from 'schema-dts'
import { getPodcastType } from 'shared-code'
import { getAssetUrl } from '~/helpers/getAssetUrl';

function generatePodcastUrl(podcast: PodcastItem): string {
    return `${DIRECTUS_CMS_URL}/podcast/${podcast.slug}`
}

function generatePersonFromSpeaker(speaker: SpeakerItem): WithContext<Person> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        givenName: speaker.first_name,
        familyName: speaker.last_name,
        jobTitle: speaker.occupation,
        image: getAssetUrl(speaker.profile_image),
        sameAs: [
            speaker.twitter_url,
            speaker.linkedin_url,
            speaker.instagram_url,
            speaker.github_url,
            speaker.youtube_url,
            speaker.website_url,
        ].filter((url) => url && url.length > 0) as string[],
    }
}

function generatePersonFromMember(member: MemberItem): WithContext<Person> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        givenName: member.first_name,
        familyName: member.last_name,
        jobTitle: member.occupation,
        image: getAssetUrl(member.normal_image),
    }
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
    }
}

function generatePodcastEpisodeFromPodcast(podcast?: PodcastItem): JsonLD | null {
    if (!podcast) return null

    const type = getPodcastType(podcast)

    const creator: Person[] = [
        ...(podcast.speakers ?? []).map(generatePersonFromSpeaker),
        ...(podcast.members ?? []).map(generatePersonFromMember),
    ]

    const partOfSeries = generatePodcastSeries()

    // noinspection UnnecessaryLocalVariableJS
    const podcastEpisode: WithContext<PodcastEpisode> = {
        '@context': 'https://schema.org',
        '@type': 'PodcastEpisode',
        name: podcast.title,
        partOfSeries,
        image: getAssetUrl(podcast.cover_image),
        description: podcast.description,
        datePublished: podcast.published_on,
        episodeNumber: `${type} ${podcast.number}`,
        url: generatePodcastUrl(podcast),
        creator,
    }

    return podcastEpisode
}

function generateProfile(profile?: DirectusProfileItem): JsonLD {

  if (!profile) return null

  const profileSchema: WithContext<Person> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    givenName: profile.first_name,
    familyName: profile.last_name,
    jobTitle: profile.job_role,
    alternateName: profile.display_name,
    image: getAssetUrl(profile.profile_image),
  }

  if (profile.job_employer) {
    profileSchema.worksFor = {
      '@type': 'Organization',
      'name': profile.job_employer
    }
  }

  return profileSchema;
}

export { generatePersonFromSpeaker, generatePodcastEpisodeFromPodcast, generatePodcastSeries, generateProfile }
