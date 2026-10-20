import { describe, expect, test } from '@jest/globals'
import {
    findRequestBlocker,
    getCooldownEnd,
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

describe('findRequestBlocker', () => {
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
