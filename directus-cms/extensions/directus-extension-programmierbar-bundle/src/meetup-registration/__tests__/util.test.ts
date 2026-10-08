import { describe, expect, test } from '@jest/globals'
import { DEFAULT_MEETUP_AGENDA, parseAgenda } from '../util/agenda.ts'
import {
    buildConfirmationMail,
    formatMeetupDate,
    formatMeetupTime,
    richTextToPlainText,
    styleRichText,
    type ConfirmationMailInput,
} from '../util/confirmationMail.ts'
import { getCapacityMilestone } from '../util/milestones.ts'

describe('parseAgenda', () => {
    test('splits time and label on the first "|"', () => {
        expect(parseAgenda('18:00 Uhr | Begrüßung\n19:00 Uhr|Talk | mit Demo')).toEqual([
            { time: '18:00 Uhr', label: 'Begrüßung' },
            { time: '19:00 Uhr', label: 'Talk | mit Demo' },
        ])
    })

    test('keeps a line without separator as an item without time', () => {
        expect(parseAgenda('Get-together')).toEqual([{ time: '', label: 'Get-together' }])
    })

    test('falls back to the default agenda for empty text', () => {
        expect(parseAgenda('  \n ')).toBe(DEFAULT_MEETUP_AGENDA)
        expect(parseAgenda(null)).toBe(DEFAULT_MEETUP_AGENDA)
    })
})

describe('getCapacityMilestone', () => {
    test('reports 80 % and full exactly once', () => {
        const hits = Array.from({ length: 100 }, (_, index) => getCapacityMilestone(index + 1, 100)).filter(Boolean)
        expect(hits).toEqual([80, 100])
    })

    test('never reports for unlimited meetups', () => {
        expect(getCapacityMilestone(80, null)).toBeNull()
        expect(getCapacityMilestone(80, undefined)).toBeNull()
    })

    test('skips the 80 % mark for tiny limits', () => {
        expect(getCapacityMilestone(3, 4)).toBeNull()
        expect(getCapacityMilestone(4, 4)).toBe(100)
    })
})

describe('date formatting', () => {
    // Stored in UTC; the mail must show Berlin time (CET in November).
    test('formats in Europe/Berlin regardless of the server time zone', () => {
        expect(formatMeetupDate('2026-11-19T17:00:00.000Z')).toBe('Donnerstag, 19. November 2026')
        expect(formatMeetupTime('2026-11-19T17:00:00.000Z', '2026-11-19T20:00:00.000Z')).toBe('18:00 – 21:00')
    })

    test('uses summer time in summer', () => {
        expect(formatMeetupTime('2026-06-18T16:00:00.000Z', '2026-06-18T19:00:00.000Z')).toBe('18:00 – 21:00')
    })
})

describe('rich text', () => {
    test('styles paragraphs and links inline', () => {
        const html = styleRichText('<p dir="ltr">Hallo <a href="https://example.com">Welt</a></p>')
        expect(html).toContain('<p style="margin:0 0 14px 0;">')
        expect(html).toContain(
            '<a style="font-weight:700;color:#CFFF00;text-decoration:none;" href="https://example.com">'
        )
    })

    test('converts to plain text with links and decoded umlauts', () => {
        const text = richTextToPlainText(
            '<p>Gr&uuml;&szlig;e aus <a href="https://example.com">Bad Nauheim</a>.</p><p>Zweiter Absatz</p>'
        )
        expect(text).toBe('Grüße aus Bad Nauheim (https://example.com).\n\nZweiter Absatz')
    })
})

describe('buildConfirmationMail', () => {
    const input: ConfirmationMailInput = {
        firstName: 'Erika <Mustermann>',
        wantsMeetupUpdates: false,
        meetup: {
            title: 'Local-first Apps mit CRDTs',
            slug: 'local-first-apps-mit-crdts',
            start_on: '2026-11-19T17:00:00.000Z',
            end_on: '2026-11-19T20:00:00.000Z',
            intro: '<p>Intro mit <a href="https://example.com">Link</a></p>',
            agenda: null,
        },
        talks: [{ title: 'Konfliktfrei offline', abstract: '<p>Abstract</p>' }],
        speakers: [{ name: 'Erika Musterfrau', occupation: 'Engineer bei Beispiel GmbH', imageUrl: null }],
        websiteUrl: 'https://www.programmier.bar',
        cancelUrl: 'https://www.programmier.bar/meetup/abmelden?token=abc',
        calendarLinks: {
            google: 'https://calendar.google.com/x?a=1&b=2',
            outlook: 'https://outlook.live.com/x',
            office365: 'https://outlook.office.com/x',
            ics: 'https://www.programmier.bar/meetup/local-first-apps-mit-crdts/kalender.ics',
        },
    }

    test('builds subject with title and Berlin date', () => {
        expect(buildConfirmationMail(input).subject).toBe(
            'Du bist beim Meetup dabei: Local-first Apps mit CRDTs am Donnerstag, 19. November 2026'
        )
    })

    test('escapes data in the HTML part and links everything the mail promises', () => {
        const { html } = buildConfirmationMail(input)
        expect(html).toContain('Hallo Erika &lt;Mustermann&gt;,')
        expect(html).toContain('href="https://calendar.google.com/x?a=1&amp;b=2"')
        expect(html).toContain('href="https://www.programmier.bar/meetup/abmelden?token=abc"')
        expect(html).toContain('https://www.programmier.bar/aufnahmen')
        expect(html).toContain('https://www.programmier.bar/verhaltensregeln')
        // Logo in header and footer
        expect(html.match(/images\/mail\/logo\.png/g)).toHaveLength(2)
        // Default agenda, initials instead of a missing photo
        expect(html).toContain('Office-Tour')
        expect(html).toContain('>EM</td>')
    })

    test('has a plain-text part with the cancel link and no markup', () => {
        const { text } = buildConfirmationMail(input)
        expect(text).toContain('Meetup-Teilnahme absagen: https://www.programmier.bar/meetup/abmelden?token=abc')
        expect(text).toContain('Uhrzeit: 18:00 – 21:00 Uhr')
        expect(text).toContain('Intro mit Link (https://example.com)')
        expect(text).not.toMatch(/<\/?(p|a|br|div|table|td)\b/i)
    })

    test('mentions the invitations only when the person opted in', () => {
        expect(buildConfirmationMail(input).text).not.toContain('kommende Meetups')
        expect(buildConfirmationMail({ ...input, wantsMeetupUpdates: true }).text).toContain(
            'informieren wir dich per E-Mail über kommende Meetups'
        )
    })
})
