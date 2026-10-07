import {
    buildIcsCalendar,
    escapeIcsText,
    foldIcsLine,
    getCalendarLinks,
    getMeetupCalendarEvent,
    getMeetupIcsPath,
} from 'shared-code'
import { describe, expect, it } from 'vitest'

const meetup = {
    id: 'a3a8b2c4-0000-4000-8000-000000000001',
    slug: 'local-first-apps',
    title: 'Local-first; Apps, mit CRDTs',
    start_on: '2026-11-19T17:00:00.000Z',
    end_on: '2026-11-19T20:00:00.000Z',
}
const event = getMeetupCalendarEvent(meetup, 'https://www.programmier.bar')

describe('buildIcsCalendar', () => {
    const ics = buildIcsCalendar(event, new Date('2026-10-07T12:00:00.000Z'))
    const lines = ics.split('\r\n')

    it('uses CRLF line endings throughout', () => {
        expect(ics.endsWith('\r\n')).toBe(true)
        expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    })

    it('writes UTC times, a stable UID and the current DTSTAMP', () => {
        expect(lines).toContain(`UID:meetup-${meetup.id}@programmier.bar`)
        expect(lines).toContain('DTSTART:20261119T170000Z')
        expect(lines).toContain('DTEND:20261119T200000Z')
        expect(lines).toContain('DTSTAMP:20261007T120000Z')
    })

    it('escapes text values and includes the venue', () => {
        expect(lines).toContain('SUMMARY:programmier.bar Meetup: Local-first\\; Apps\\, mit CRDTs')
        expect(ics).toContain('LOCATION:Lotum media GmbH\\, Am Goldstein 1\\, 61231 Bad Nauheim')
        expect(lines).toContain('URL:https://www.programmier.bar/meetup/local-first-apps')
    })
})

describe('ICS text helpers', () => {
    it('escapes backslashes, newlines, semicolons and commas', () => {
        expect(escapeIcsText('a\\b\nc;d,e')).toBe('a\\\\b\\nc\\;d\\,e')
    })

    it('folds long lines at 75 octets without splitting umlauts', () => {
        const folded = foldIcsLine(`SUMMARY:${'ä'.repeat(60)}`)
        const parts = folded.split('\r\n')
        expect(parts.length).toBeGreaterThan(1)
        for (const part of parts) {
            expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
        }
        expect(parts.map((part, index) => (index === 0 ? part : part.slice(1))).join('')).toBe(
            `SUMMARY:${'ä'.repeat(60)}`
        )
    })
})

describe('getCalendarLinks', () => {
    const links = getCalendarLinks(event, `https://www.programmier.bar${getMeetupIcsPath(meetup.slug)}`)

    it('builds a Google Calendar template link in UTC', () => {
        const url = new URL(links.google)
        expect(url.host).toBe('calendar.google.com')
        expect(url.searchParams.get('action')).toBe('TEMPLATE')
        expect(url.searchParams.get('dates')).toBe('20261119T170000Z/20261119T200000Z')
        expect(url.searchParams.get('location')).toBe('Lotum media GmbH, Am Goldstein 1, 61231 Bad Nauheim')
    })

    it('builds Outlook.com and Microsoft 365 compose links', () => {
        expect(new URL(links.outlook).host).toBe('outlook.live.com')
        expect(new URL(links.office365).host).toBe('outlook.office.com')
        const url = new URL(links.office365)
        expect(url.searchParams.get('startdt')).toBe('2026-11-19T17:00:00Z')
        expect(url.searchParams.get('enddt')).toBe('2026-11-19T20:00:00Z')
        // Spaces as %20: Outlook shows a `+` literally.
        expect(links.outlook).not.toContain('+')
    })

    it('points the .ics link at the per-meetup route', () => {
        expect(links.ics).toBe('https://www.programmier.bar/meetup/local-first-apps/kalender.ics')
    })
})
