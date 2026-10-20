import { describe, expect, test } from '@jest/globals'
import {
    findRequestBlockers,
    getCooldownEnd,
    hasVersionChanges,
    isWithinCooldown,
    PROFILE_UPDATE_COOLDOWN_DAYS,
} from '../util/requestGuards.ts'

const NOW = new Date('2026-10-20T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

describe('cooldown', () => {
    test('is 90 days', () => {
        expect(PROFILE_UPDATE_COOLDOWN_DAYS).toBe(90)
    })

    test('a speaker that was never asked is not in the cooldown', () => {
        expect(getCooldownEnd(null)).toBeNull()
        expect(isWithinCooldown(null, NOW)).toBe(false)
        expect(isWithinCooldown('not a date', NOW)).toBe(false)
    })

    test.each([
        [0, true],
        [89, true],
        [90, false],
        [200, false],
    ])('a request %i days ago → within cooldown: %s', (days, expected) => {
        expect(isWithinCooldown(daysAgo(days), NOW)).toBe(expected)
    })
})

describe('findRequestBlockers', () => {
    const findRequestBlocker = (...args: Parameters<typeof findRequestBlockers>) =>
        findRequestBlockers(...args)[0] ?? null

    test('nothing blocks a speaker who already submitted and was not asked recently', () => {
        expect(
            findRequestBlocker(
                { portal_submission_status: 'submitted', portal_token: null, portal_update_requested_at: daysAgo(120) },
                NOW
            )
        ).toBeNull()
    })

    test('a recent request blocks with the cooldown code and names the date', () => {
        const blocker = findRequestBlocker({ portal_update_requested_at: daysAgo(10) }, NOW)
        expect(blocker?.code).toBe('cooldown')
        expect(blocker?.message).toContain('10.10.2026')
    })

    test('an open invitation blocks, because the new token would kill its link', () => {
        const blocker = findRequestBlocker(
            {
                portal_submission_status: 'pending',
                portal_token: 'tok',
                portal_token_expires: '2026-10-25T00:00:00.000Z',
            },
            NOW
        )
        expect(blocker?.code).toBe('invitation_pending')
    })

    test('an expired or token-less invitation does not block', () => {
        expect(
            findRequestBlocker(
                {
                    portal_submission_status: 'pending',
                    portal_token: 'tok',
                    portal_token_expires: '2026-10-01T00:00:00.000Z',
                },
                NOW
            )
        ).toBeNull()
        expect(findRequestBlocker({ portal_submission_status: 'pending', portal_token: null }, NOW)).toBeNull()
    })
})

describe('profile-update version', () => {
    test.each([
        [{ delta: null }, false],
        [{ delta: {} }, false],
        [{}, false],
        [{ delta: { occupation: 'CEO' } }, true],
    ])('%o has changes: %s', (version, expected) => {
        expect(hasVersionChanges(version)).toBe(expected)
    })

    test('a version with changes blocks, naming it', () => {
        const blockers = findRequestBlockers({}, NOW, [
            { name: 'Profil-Update 01.09.2026', delta: { first_name: 'E' } },
        ])
        expect(blockers.map((blocker) => blocker.code)).toEqual(['unreviewed_version'])
        expect(blockers[0].message).toContain('„Profil-Update 01.09.2026“')
    })

    test('an empty version does not block', () => {
        expect(findRequestBlockers({}, NOW, [{ name: 'x', delta: null }])).toEqual([])
    })

    test('lists every blocker, in a fixed order', () => {
        const blockers = findRequestBlockers(
            {
                portal_update_requested_at: daysAgo(10),
                portal_submission_status: 'pending',
                portal_token: 'tok',
                portal_token_expires: '2026-10-25T00:00:00.000Z',
            },
            NOW,
            [{ delta: { first_name: 'E' } }]
        )
        expect(blockers.map((blocker) => blocker.code)).toEqual([
            'cooldown',
            'invitation_pending',
            'unreviewed_version',
        ])
    })
})
