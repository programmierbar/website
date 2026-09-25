import { describe, expect, it, vi } from 'vitest'
import { EVENT_LOCATION, WEBSITE_URL } from '../config'
import {
    generateEventFromConference,
    generateEventFromMeetup,
    generatePersonFromSpeaker,
    generatePodcastEpisodeFromPodcast,
    generatePodcastSeries,
} from '../helpers/jsonLdGenerator'
import type { ConferenceItem, MeetupItem, PodcastItem, SpeakerItem } from '../types'

// `shared-code` is a Nuxt alias, which plain Vitest does not resolve
vi.mock('shared-code', () => import('../../shared-code'))

// The schema-dts types are unions that are awkward to inspect in assertions
function asRecord(value: unknown) {
    return value as Record<string, unknown>
}

const cover = { id: 'cover-id', title: 'cover.jpg', type: 'image/jpeg', width: 1500, height: 1500 }

const podcast = {
    slug: 'deep-dive-123-thema',
    type: 'deep_dive',
    number: '123',
    title: 'Thema',
    published_on: '2026-09-25T06:00:00.000Z',
    cover_image: cover,
    description: '<p>Erster Absatz.</p><p>Zweiter Absatz mit &Uuml;mlaut.</p>',
    speakers: [],
    members: [],
} as unknown as PodcastItem

describe('generatePodcastEpisodeFromPodcast', () => {
    it('links the episode on the website, not the CMS', () => {
        const episode = asRecord(generatePodcastEpisodeFromPodcast(podcast))
        expect(episode.url).toBe(`${WEBSITE_URL}/podcast/deep-dive-123-thema`)
    })

    it('uses plain text as description', () => {
        const episode = asRecord(generatePodcastEpisodeFromPodcast(podcast))
        expect(episode.description).toBe('Erster Absatz. Zweiter Absatz mit Ümlaut.')
    })

    it('lists speakers and members from their junction rows as creators', () => {
        const episode = asRecord(
            generatePodcastEpisodeFromPodcast({
                ...podcast,
                speakers: [
                    {
                        id: 1,
                        speaker: {
                            first_name: 'Erika',
                            last_name: 'Muster',
                            academic_title: 'Dr.',
                            occupation: 'Entwicklerin',
                            profile_image: cover,
                        },
                    },
                ],
                members: [
                    { id: 2, member: { first_name: 'Max', last_name: 'Beispiel', normal_image: 'member-image' } },
                    // Unexpanded relations must not turn into empty people
                    { id: 3, member: 'member-id' },
                    4,
                ],
            } as unknown as PodcastItem)
        )
        expect(episode.creator).toEqual([
            {
                '@context': 'https://schema.org',
                '@type': 'Person',
                name: 'Erika Muster',
                givenName: 'Erika',
                familyName: 'Muster',
                honorificPrefix: 'Dr.',
                jobTitle: 'Entwicklerin',
                image: expect.stringMatching(/\/assets\/cover-id$/),
                sameAs: undefined,
            },
            {
                '@context': 'https://schema.org',
                '@type': 'Person',
                name: 'Max Beispiel',
                givenName: 'Max',
                familyName: 'Beispiel',
                jobTitle: undefined,
                image: expect.stringMatching(/\/assets\/member-image$/),
            },
        ])
    })

    it('omits the creators if there are none', () => {
        const episode = asRecord(generatePodcastEpisodeFromPodcast(podcast))
        expect(episode.creator).toBeUndefined()
    })

    it('returns null without a podcast', () => {
        expect(generatePodcastEpisodeFromPodcast(undefined)).toBeNull()
    })
})

describe('generatePodcastSeries', () => {
    it('links the series on the canonical host', () => {
        const series = generatePodcastSeries()
        expect(series.url).toBe(WEBSITE_URL)
        expect(series.mainEntityOfPage).toBe(WEBSITE_URL)
    })
})

describe('generatePersonFromSpeaker', () => {
    it('omits the image and empty profile links if there are none', () => {
        const person = asRecord(
            generatePersonFromSpeaker({
                first_name: 'Erika',
                last_name: 'Muster',
                occupation: 'Entwicklerin',
                profile_image: null,
                github_url: 'https://github.com/example',
                twitter_url: '',
            } as unknown as SpeakerItem)
        )
        expect(person.image).toBeUndefined()
        expect(person.sameAs).toEqual(['https://github.com/example'])
    })
})

describe('generateEventFromMeetup', () => {
    it('describes the meetup as an event with its dates and teaser', () => {
        const event = asRecord(
            generateEventFromMeetup({
                slug: 'mein-meetup',
                title: 'Mein Meetup',
                intro: '<p>Worum es geht.</p><p>Und warum.</p>',
                description: '<p>Lightning Talks</p><p>Agenda</p>',
                start_on: '2026-10-22T16:00:00.000Z',
                end_on: '2026-10-22T20:00:00.000Z',
                cover_image: cover,
            } as unknown as MeetupItem)
        )
        expect(event['@type']).toBe('Event')
        expect(event.name).toBe('Mein Meetup')
        expect(event.description).toBe('Worum es geht. Und warum.')
        expect(event.startDate).toBe('2026-10-22T16:00:00.000Z')
        expect(event.endDate).toBe('2026-10-22T20:00:00.000Z')
        expect(event.url).toBe(`${WEBSITE_URL}/meetup/mein-meetup`)
        expect(event.image).toMatch(/\/assets\/cover-id$/)
        expect(event.eventStatus).toBe('https://schema.org/EventScheduled')
        expect(event.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode')
        expect(event.location).toEqual({
            '@type': 'Place',
            name: EVENT_LOCATION.name,
            address: {
                '@type': 'PostalAddress',
                streetAddress: 'Am Goldstein 1',
                postalCode: '61231',
                addressLocality: 'Bad Nauheim',
                addressCountry: 'DE',
            },
        })
    })

    it('falls back to the description for meetups without an intro', () => {
        for (const intro of [null, '', '<p></p>']) {
            const event = asRecord(
                generateEventFromMeetup({
                    slug: 'altes-meetup',
                    title: 'Altes Meetup',
                    intro,
                    description: '<p>Vortrag</p><p>Diskussion</p>',
                    start_on: '2024-10-22T16:00:00.000Z',
                    end_on: '2024-10-22T20:00:00.000Z',
                    cover_image: cover,
                } as unknown as MeetupItem)
            )
            expect(event.description).toBe('Vortrag Diskussion')
        }
    })

    it('returns null without a meetup', () => {
        expect(generateEventFromMeetup(undefined)).toBeNull()
    })
})

describe('generateEventFromConference', () => {
    it('reads bare CMS datetimes as Berlin time', () => {
        const event = asRecord(
            generateEventFromConference({
                slug: 'meine-konferenz',
                title: 'Meine Konferenz',
                text_1: 'Zwei Tage',
                start_on: '2026-11-25T08:00:00',
                end_on: '2026-11-26T18:00:00',
                cover_image: cover,
            } as unknown as ConferenceItem)
        )
        expect(event.startDate).toBe('2026-11-25T07:00:00.000Z')
        expect(event.endDate).toBe('2026-11-26T17:00:00.000Z')
        expect(event.url).toBe(`${WEBSITE_URL}/konferenz/meine-konferenz`)
        expect(event.location).toBe(EVENT_LOCATION)
    })
})
