import type {
    ConferenceItem,
    DirectusMemberItem,
    DirectusProfileItem,
    DirectusSpeakerItem,
    FileItem,
    MeetupItem,
    PodcastItem,
} from '~/types'
import type { JsonLD } from 'nuxt-jsonld/dist/types/index.d'
import type { Event, Person, PodcastEpisode, PodcastSeries, WithContext } from 'schema-dts'
import { getPodcastType } from 'shared-code'
import { BUZZSPROUT_RSS_FEED_URL, EVENT_LOCATION, WEBSITE_NAME, WEBSITE_URL } from '../config'
import { getAssetUrl } from './getAssetUrl'
import { getMeetupTeaser } from './getMeetupTeaser'
import { parseCmsDate } from './parseCmsDate'
import { getPlainText } from './sanitize'

function generatePodcastUrl(podcast: PodcastItem): string {
    return `${WEBSITE_URL}/podcast/${podcast.slug}`
}

// Omit the image instead of emitting an empty string when there is none
function getImageUrl(image?: FileItem | string | null): string | undefined {
    return getAssetUrl(image) || undefined
}

function generatePersonFromSpeaker(speaker: DirectusSpeakerItem): WithContext<Person> {
    // Not every query loads the profile links, e.g. the speakers of a podcast
    const sameAs = [
        speaker.twitter_url,
        speaker.linkedin_url,
        speaker.instagram_url,
        speaker.github_url,
        speaker.youtube_url,
        speaker.website_url,
    ].filter((url): url is string => !!url)

    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: `${speaker.first_name} ${speaker.last_name}`,
        givenName: speaker.first_name,
        familyName: speaker.last_name,
        honorificPrefix: speaker.academic_title || undefined,
        jobTitle: speaker.occupation || undefined,
        image: getImageUrl(speaker.profile_image),
        sameAs: sameAs.length ? sameAs : undefined,
    }
}

function generatePersonFromMember(member: DirectusMemberItem): WithContext<Person> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: `${member.first_name} ${member.last_name}`,
        givenName: member.first_name,
        familyName: member.last_name,
        jobTitle: member.occupation || undefined,
        image: getImageUrl(member.normal_image),
    }
}

function generatePodcastSeries(): WithContext<PodcastSeries> {
    return {
        '@context': 'https://schema.org',
        '@type': 'PodcastSeries',
        name: WEBSITE_NAME,
        url: WEBSITE_URL,
        mainEntityOfPage: WEBSITE_URL,
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

    // `speakers` and `members` hold the junction rows, not the people
    const speakers = (podcast.speakers ?? [])
        .map((row) => row?.speaker)
        .filter((speaker): speaker is DirectusSpeakerItem => typeof speaker === 'object' && speaker !== null)
    const members = (podcast.members ?? [])
        .map((row) => (typeof row === 'object' && row !== null ? row.member : null))
        .filter((member): member is DirectusMemberItem => typeof member === 'object' && member !== null)
    const creator: Person[] = [...speakers.map(generatePersonFromSpeaker), ...members.map(generatePersonFromMember)]

    const partOfSeries = generatePodcastSeries()

    // noinspection UnnecessaryLocalVariableJS
    const podcastEpisode: WithContext<PodcastEpisode> = {
        '@context': 'https://schema.org',
        '@type': 'PodcastEpisode',
        name: podcast.title,
        partOfSeries,
        image: getImageUrl(podcast.cover_image),
        description: getPlainText(podcast.description),
        datePublished: podcast.published_on,
        episodeNumber: `${type} ${podcast.number}`,
        url: generatePodcastUrl(podcast),
        creator: creator.length ? creator : undefined,
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
        image: getImageUrl(profile.profile_image),
    }

    if (profile.job_employer) {
        profileSchema.worksFor = {
            '@type': 'Organization',
            name: profile.job_employer,
        }
    }

    return profileSchema
}

function generateEvent(
    event: Pick<MeetupItem | ConferenceItem, 'title' | 'start_on' | 'end_on' | 'cover_image'>,
    description: string,
    path: string
): WithContext<Event> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        description,
        startDate: parseCmsDate(event.start_on).toISOString(),
        endDate: parseCmsDate(event.end_on).toISOString(),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: EVENT_LOCATION,
        image: getImageUrl(event.cover_image),
        url: WEBSITE_URL + path,
        organizer: {
            '@type': 'Organization',
            name: WEBSITE_NAME,
            url: WEBSITE_URL,
        },
    }
}

function generateEventFromMeetup(meetup?: MeetupItem): JsonLD | null {
    if (!meetup) return null
    return generateEvent(meetup, getMeetupTeaser(meetup), `/meetup/${meetup.slug}`)
}

function generateEventFromConference(conference?: ConferenceItem): JsonLD | null {
    if (!conference) return null
    return generateEvent(conference, getPlainText(conference.text_1), `/konferenz/${conference.slug}`)
}

export {
    generateEventFromConference,
    generateEventFromMeetup,
    generatePersonFromSpeaker,
    generatePodcastEpisodeFromPodcast,
    generatePodcastSeries,
    generateProfile,
}
