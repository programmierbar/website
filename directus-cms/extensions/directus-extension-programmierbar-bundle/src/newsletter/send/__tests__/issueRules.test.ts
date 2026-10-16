import { describe, expect, test } from '@jest/globals'
import { blockCountAfter, checkIssueWrite, type IssueState } from '../issueRules.ts'

const DRAFT: IssueState = { status: 'draft', subject: 'Oktober', scheduled_at: '2026-10-15T09:00:00Z', blockCount: 2 }

describe('blockCountAfter', () => {
    test('handles unchanged, full list and change set', () => {
        expect(blockCountAfter(2, undefined)).toBe(2)
        expect(blockCountAfter(2, [{ collection: 'x' }])).toBe(1)
        expect(blockCountAfter(2, { create: [{}], update: [{}], delete: [1, 2] })).toBe(1)
        expect(blockCountAfter(0, { create: [] })).toBe(0)
    })
})

describe('checkIssueWrite – create', () => {
    test('a draft can be created without anything', () => {
        expect(checkIssueWrite({ status: 'draft' }, null, false)).toBeNull()
    })

    test('creating an issue already scheduled requires subject, scheduled_at and a block', () => {
        expect(checkIssueWrite({ status: 'scheduled' }, null, false)).toBe(
            'Zum Einplanen fehlt: Betreff, Versandzeitpunkt (scheduled_at), mindestens ein Block.'
        )
        expect(
            checkIssueWrite(
                { status: 'scheduled', subject: 'X', scheduled_at: '2026-10-15T09:00:00Z', blocks: { create: [{}] } },
                null,
                false
            )
        ).toBeNull()
    })

    test('creating an issue as sending or sent is not allowed for users', () => {
        expect(checkIssueWrite({ status: 'sent' }, null, false)).toContain('setzt nur der Versand')
    })

    test('html_snapshot cannot be written by users', () => {
        expect(checkIssueWrite({ html_snapshot: '<p>x</p>' }, null, false)).toContain('nur vom Versand')
    })
})

describe('checkIssueWrite – update', () => {
    test('scheduling a complete draft is allowed', () => {
        expect(checkIssueWrite({ status: 'scheduled' }, DRAFT, false)).toBeNull()
    })

    test('scheduling needs a subject, a scheduled_at and at least one block', () => {
        expect(checkIssueWrite({ status: 'scheduled' }, { ...DRAFT, subject: ' ' }, false)).toContain('Betreff')
        expect(checkIssueWrite({ status: 'scheduled' }, { ...DRAFT, scheduled_at: null }, false)).toContain(
            'Versandzeitpunkt'
        )
        expect(checkIssueWrite({ status: 'scheduled' }, { ...DRAFT, blockCount: 0 }, false)).toContain('Block')
    })

    test('emptying a scheduled issue is rejected too', () => {
        const scheduled = { ...DRAFT, status: 'scheduled' }
        expect(checkIssueWrite({ subject: '' }, scheduled, false)).toContain('Betreff')
        expect(checkIssueWrite({ blocks: { delete: [1, 2] } }, scheduled, false)).toContain('Block')
    })

    test('content is frozen while sending and after sending, the status may still change', () => {
        const sending = { ...DRAFT, status: 'sending' }
        expect(checkIssueWrite({ subject: 'Neu' }, sending, false)).toContain('subject kann nicht mehr geändert werden')
        expect(checkIssueWrite({ blocks: { update: [{}] } }, { ...DRAFT, status: 'sent' }, false)).toContain('blocks')
        // Stopping a running send by hand stays possible.
        expect(checkIssueWrite({ status: 'draft' }, sending, false)).toBeNull()
    })

    test('users cannot set sending or sent', () => {
        expect(checkIssueWrite({ status: 'sending' }, DRAFT, false)).toContain('setzt nur der Versand')
    })

    test('system writes (the send job) are not restricted', () => {
        expect(checkIssueWrite({ status: 'sending', html_snapshot: 'x' }, DRAFT, true)).toBeNull()
    })
})
