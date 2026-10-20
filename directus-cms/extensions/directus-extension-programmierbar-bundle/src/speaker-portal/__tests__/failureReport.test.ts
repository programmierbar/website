import { describe, expect, test } from '@jest/globals'
import {
    buildFailureSlackMessage,
    createFailureReportDeduper,
    FAILURE_MESSAGE_MAX_LENGTH,
    parseFailureReport,
    sanitizeFailureMessage,
} from '../util/failureReport.ts'

describe('sanitizeFailureMessage', () => {
    test('keeps an ordinary error message as it is', () => {
        expect(sanitizeFailureMessage('Content Versioning is not enabled for collection "speakers"')).toBe(
            'Content Versioning is not enabled for collection "speakers"'
        )
    })

    test('redacts e-mail addresses', () => {
        expect(sanitizeFailureMessage('Duplicate value erika.m+test@example.co.uk for "email"')).toBe(
            'Duplicate value [E-Mail] for "email"'
        )
    })

    test('flattens to one line and drops control and invisible characters', () => {
        expect(sanitizeFailureMessage('first\n\nsecond\tthird\u0000\u200b\u202efourth')).toBe(
            'first second third fourth'
        )
    })

    test('neutralises Slack mentions, links and entities', () => {
        expect(sanitizeFailureMessage('<!channel> <@U123> <https://evil.example|klick> &amp;')).toBe(
            '&lt;!channel&gt; &lt;@U123&gt; &lt;https://evil.example|klick&gt; &amp;amp;'
        )
    })

    test('stays fast on a huge input without an @ (no regex backtracking blow-up)', () => {
        const started = Date.now()
        sanitizeFailureMessage('a'.repeat(1_000_000))
        expect(Date.now() - started).toBeLessThan(500)
    })

    test('caps the length before escaping, so no entity is cut in half', () => {
        const capped = sanitizeFailureMessage('x'.repeat(FAILURE_MESSAGE_MAX_LENGTH + 50))
        expect(capped).toHaveLength(FAILURE_MESSAGE_MAX_LENGTH)
        expect(capped.endsWith('…')).toBe(true)

        const escaped = sanitizeFailureMessage('<'.repeat(FAILURE_MESSAGE_MAX_LENGTH + 50))
        expect(escaped).toMatch(/^(&lt;)+…$/)
    })
})

describe('parseFailureReport', () => {
    test('accepts a stage identifier and a message', () => {
        expect(parseFailureReport({ stage: ' save_version ', message: 'boom' })).toEqual({
            ok: true,
            report: { stage: 'save_version', message: 'boom' },
        })
    })

    test('fills in an empty message instead of posting nothing', () => {
        expect(parseFailureReport({ stage: 'save_version', message: ' \n ' })).toEqual({
            ok: true,
            report: { stage: 'save_version', message: '(keine Fehlermeldung)' },
        })
    })

    test.each([undefined, null, {}, { stage: 'ok' }, { stage: '<!here>', message: 'x' }, { stage: 3, message: 'x' }])(
        'rejects %o',
        (body) => {
            expect(parseFailureReport(body).ok).toBe(false)
        }
    )
})

describe('createFailureReportDeduper', () => {
    test('lets a key through once per window and again afterwards', () => {
        const deduper = createFailureReportDeduper(1000)
        expect(deduper.claim('a', 0)).toBe(true)
        expect(deduper.claim('a', 999)).toBe(false)
        expect(deduper.claim('b', 999)).toBe(true)
        expect(deduper.claim('a', 1000)).toBe(true)
    })

    test('a released key can be claimed again right away', () => {
        const deduper = createFailureReportDeduper(1000)
        deduper.claim('a', 0)
        deduper.release('a')
        expect(deduper.claim('a', 1)).toBe(true)
    })
})

describe('buildFailureSlackMessage', () => {
    const base = {
        report: { stage: 'save_version', message: 'boom.' },
        itemUrl: 'https://admin.example.com/admin/content/speakers/s1',
        now: new Date('2026-10-20T12:00:00.000Z'),
        formatDate: (date: string) => `F(${date})`,
    }

    test('names the speaker, the stage, the error, the link validity and the item', () => {
        const text = buildFailureSlackMessage({
            ...base,
            speaker: { first_name: 'Erika', last_name: 'Mustermann', portal_token_expires: '2026-10-28T00:00:00Z' },
        })
        expect(text).toBe(
            ':x: *Speaker Portal*: Das Profil-Update von Erika Mustermann konnte auf der Website nicht gespeichert ' +
                'werden (Schritt „save_version“): boom. Der Portal-Link ist weiterhin gültig (bis F(2026-10-28T00:00:00Z)), ' +
                'ein erneuter Versuch ist möglich. https://admin.example.com/admin/content/speakers/s1'
        )
    })

    test('escapes Slack markup in the speaker name', () => {
        const text = buildFailureSlackMessage({ ...base, speaker: { first_name: '<!channel>', last_name: null } })
        expect(text).toContain('von &lt;!channel&gt; konnte')
    })
})
