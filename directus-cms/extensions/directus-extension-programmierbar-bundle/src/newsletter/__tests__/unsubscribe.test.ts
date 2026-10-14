import { describe, expect, test } from '@jest/globals'
import { buildListUnsubscribeHeaders, buildUnsubscribeUrl, TEST_UNSUBSCRIBE_TOKEN } from '../unsubscribe.ts'

describe('buildUnsubscribeUrl', () => {
    test('builds the website link the double-opt-in mail uses', () => {
        expect(buildUnsubscribeUrl('https://www.programmier.bar/', 'a b')).toBe(
            'https://www.programmier.bar/newsletter/unsubscribe?token=a%20b'
        )
    })
})

describe('TEST_UNSUBSCRIBE_TOKEN', () => {
    // A malformed value makes Directus answer 500 on the uuid column; a well-formed one
    // that matches nobody yields the website's neutral "invalid link".
    test('is a well-formed UUID', () => {
        expect(TEST_UNSUBSCRIBE_TOKEN).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
})

describe('buildListUnsubscribeHeaders', () => {
    test('has the https link and RFC 8058 one-click, no mailto', () => {
        expect(buildListUnsubscribeHeaders('https://x.test/u?token=1')).toEqual({
            'List-Unsubscribe': '<https://x.test/u?token=1>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        })
    })
})
