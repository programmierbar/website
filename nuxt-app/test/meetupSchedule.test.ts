import { describe, expect, it } from 'vitest'
import { getPastMeetups, getUpcomingMeetups } from '../helpers/meetupSchedule'

// The ordering is the reason this exists. `getMeetups` sorts newest first, which put the meetup
// furthest out at the top of the upcoming section and the next one at the bottom.

const NOW = new Date('2026-06-15T12:00:00Z')

// Newest first, the order the CMS query returns.
const MEETUPS = [
    { slug: 'in-three-months', start_on: '2026-09-01T18:00:00Z' },
    { slug: 'next-week', start_on: '2026-06-22T18:00:00Z' },
    { slug: 'tomorrow', start_on: '2026-06-16T18:00:00Z' },
    { slug: 'last-month', start_on: '2026-05-10T18:00:00Z' },
    { slug: 'last-year', start_on: '2025-06-10T18:00:00Z' },
]

describe('getUpcomingMeetups', () => {
    it('returns only meetups that start after the reference time', () => {
        expect(getUpcomingMeetups(MEETUPS, NOW).map((meetup) => meetup.slug)).toEqual([
            'tomorrow',
            'next-week',
            'in-three-months',
        ])
    })

    it('sorts soonest first, whatever order it is given', () => {
        const reversed = [...MEETUPS].reverse()

        expect(getUpcomingMeetups(reversed, NOW).map((meetup) => meetup.slug)).toEqual([
            'tomorrow',
            'next-week',
            'in-three-months',
        ])
    })

    it('leaves the input array untouched', () => {
        const meetups = [...MEETUPS]

        getUpcomingMeetups(meetups, NOW)

        expect(meetups).toEqual(MEETUPS)
    })

    it('returns nothing when every meetup is in the past', () => {
        expect(getUpcomingMeetups(MEETUPS, new Date('2027-01-01T00:00:00Z'))).toEqual([])
    })
})

describe('getPastMeetups', () => {
    it('returns only meetups that started before the reference time', () => {
        expect(getPastMeetups(MEETUPS, NOW).map((meetup) => meetup.slug)).toEqual(['last-month', 'last-year'])
    })

    it('keeps the incoming order, which the CMS query already sorts newest first', () => {
        expect(getPastMeetups(MEETUPS, new Date('2027-01-01T00:00:00Z')).map((meetup) => meetup.slug)).toEqual([
            'in-three-months',
            'next-week',
            'tomorrow',
            'last-month',
            'last-year',
        ])
    })
})

describe('the two selections together', () => {
    it('split the meetups without dropping or duplicating one', () => {
        const upcoming = getUpcomingMeetups(MEETUPS, NOW)
        const past = getPastMeetups(MEETUPS, NOW)

        expect(upcoming.length + past.length).toBe(MEETUPS.length)
        expect([...upcoming, ...past].map((meetup) => meetup.slug).sort()).toEqual(
            MEETUPS.map((meetup) => meetup.slug).sort()
        )
    })
})
