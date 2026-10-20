import { describe, expect, test } from '@jest/globals'
import {
    buildPortalUrl,
    buildPublicProfileUrl,
    createPortalToken,
    PORTAL_TOKEN_VALIDITY_DAYS,
} from '../speakerPortal.ts'

describe('speaker portal links', () => {
    test('portal URL encodes the token and tolerates a trailing slash in website_url', () => {
        expect(buildPortalUrl('https://www.programmier.bar/', 'a b')).toBe(
            'https://www.programmier.bar/speaker-portal?token=a%20b'
        )
    })

    test('public profile URL points at the Hall of Fame', () => {
        expect(buildPublicProfileUrl('https://www.programmier.bar', 'erika-mustermann')).toBe(
            'https://www.programmier.bar/hall-of-fame/erika-mustermann'
        )
    })

    test('a new token is a UUID that expires after the shared validity', () => {
        const now = new Date('2026-06-01T10:00:00.000Z')
        const { portal_token, portal_token_expires } = createPortalToken(now)
        const expected = new Date(now)
        expected.setDate(expected.getDate() + PORTAL_TOKEN_VALIDITY_DAYS)

        expect(portal_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
        expect(portal_token_expires).toBe(expected.toISOString())
        expect(createPortalToken(now).portal_token).not.toBe(portal_token)
    })
})
