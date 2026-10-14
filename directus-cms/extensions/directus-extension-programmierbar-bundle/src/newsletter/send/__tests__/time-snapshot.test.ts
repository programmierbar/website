import { describe, expect, test } from '@jest/globals'
import { renderNewsletterIssue } from '../../render/index.ts'
import { hasUnsubscribePlaceholder, personalizeSnapshot, UNSUBSCRIBE_URL_PLACEHOLDER } from '../snapshot.ts'
import { berlinDayKey, berlinDayStart, parseDirectusDateTime } from '../time.ts'

describe('Berlin day', () => {
    test('starts at local midnight in summer and winter time', () => {
        expect(berlinDayStart(new Date('2026-10-15T08:00:00Z')).toISOString()).toBe('2026-10-14T22:00:00.000Z')
        expect(berlinDayStart(new Date('2026-12-01T08:00:00Z')).toISOString()).toBe('2026-11-30T23:00:00.000Z')
        // 23:30 UTC is already the next day in Berlin.
        expect(berlinDayKey(new Date('2026-10-14T23:30:00Z'))).toBe('2026-10-15')
    })

    test('handles the day of the switch to winter time', () => {
        expect(berlinDayStart(new Date('2026-10-25T12:00:00Z')).toISOString()).toBe('2026-10-24T22:00:00.000Z')
    })
})

describe('parseDirectusDateTime', () => {
    test('parses values and rejects garbage', () => {
        expect(parseDirectusDateTime('2026-10-15T09:00:00Z')?.toISOString()).toBe('2026-10-15T09:00:00.000Z')
        expect(parseDirectusDateTime('2026-10-15T09:00:00')?.getHours()).toBe(9)
        expect(parseDirectusDateTime('kein datum')).toBeNull()
        expect(parseDirectusDateTime(null)).toBeNull()
    })
})

describe('snapshot personalisation', () => {
    test('replaces every placeholder with the escaped personal link', () => {
        const html = `<a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">x</a> ${UNSUBSCRIBE_URL_PLACEHOLDER}`
        expect(hasUnsubscribePlaceholder(html)).toBe(true)
        expect(personalizeSnapshot(html, 'https://w.de/u?token=1&x=2')).toBe(
            '<a href="https://w.de/u?token=1&amp;x=2">x</a> https://w.de/u?token=1&amp;x=2'
        )
        expect(hasUnsubscribePlaceholder('<p>ohne</p>')).toBe(false)
    })
})

describe('snapshot render', () => {
    test('survives the real MJML render, so the stored snapshot can be personalised', async () => {
        const { html } = await renderNewsletterIssue(
            { subject: 'S', blocks: [] },
            { websiteUrl: 'https://www.programmier.bar', unsubscribeUrl: UNSUBSCRIBE_URL_PLACEHOLDER }
        )
        expect(html).toContain(`href="${UNSUBSCRIBE_URL_PLACEHOLDER}"`)
    })
})
