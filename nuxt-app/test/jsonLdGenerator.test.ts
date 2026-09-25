import { describe, expect, it, vi } from 'vitest'
import { WEBSITE_URL } from '../config'
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
    it('describes the meetup as an event with its dates', () => {
        const event = asRecord(
            generateEventFromMeetup({
                slug: 'mein-meetup',
                title: 'Mein Meetup',
                description: '<p>Vortrag</p><p>Diskussion</p>',
                start_on: '2026-10-22T16:00:00.000Z',
                end_on: '2026-10-22T20:00:00.000Z',
                cover_image: cover,
            } as unknown as MeetupItem)
        )
        expect(event['@type']).toBe('Event')
        expect(event.name).toBe('Mein Meetup')
        expect(event.description).toBe('Vortrag Diskussion')
        expect(event.startDate).toBe('2026-10-22T16:00:00.000Z')
        expect(event.endDate).toBe('2026-10-22T20:00:00.000Z')
        expect(event.url).toBe(`${WEBSITE_URL}/meetup/mein-meetup`)
        expect(event.image).toMatch(/\/assets\/cover-id$/)
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
    })
})
