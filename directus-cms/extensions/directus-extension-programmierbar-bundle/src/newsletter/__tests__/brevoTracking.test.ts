import { describe, expect, test } from '@jest/globals'
import { buildNewsletterTrackingHeaders, parseNewsletterTracking } from '../brevoTracking.ts'

const SEND_ID = '6f1c2a5e-0000-4000-8000-0000000000aa'

describe('buildNewsletterTrackingHeaders', () => {
    test('a real send carries its send id', () => {
        expect(buildNewsletterTrackingHeaders('send', SEND_ID)).toEqual({
            'X-Mailin-custom': `newsletter:send:${SEND_ID}`,
            'X-Mailin-Tag': 'newsletter',
        })
    })

    test('test send and double opt-in are marked without an id', () => {
        expect(buildNewsletterTrackingHeaders('test')).toEqual({
            'X-Mailin-custom': 'newsletter:test',
            'X-Mailin-Tag': 'newsletter-test',
        })
        expect(buildNewsletterTrackingHeaders('double-opt-in')).toEqual({
            'X-Mailin-custom': 'newsletter:double-opt-in',
            'X-Mailin-Tag': 'newsletter-double-opt-in',
        })
    })
})

describe('parseNewsletterTracking', () => {
    test('reads back what the builder wrote', () => {
        const send = buildNewsletterTrackingHeaders('send', SEND_ID)
        expect(parseNewsletterTracking(send['X-Mailin-custom'], [send['X-Mailin-Tag']])).toEqual({
            isNewsletter: true,
            sendId: SEND_ID,
        })
        const doi = buildNewsletterTrackingHeaders('double-opt-in')
        expect(parseNewsletterTracking(doi['X-Mailin-custom'], [])).toEqual({ isNewsletter: true, sendId: null })
    })

    test('the tag alone is enough to recognise a newsletter mail', () => {
        expect(parseNewsletterTracking(undefined, ['newsletter'])).toEqual({ isNewsletter: true, sendId: null })
        expect(parseNewsletterTracking('', ['newsletter-test'])).toEqual({ isNewsletter: true, sendId: null })
    })

    test('other mails are not newsletter mails', () => {
        expect(parseNewsletterTracking(undefined, undefined)).toEqual({ isNewsletter: false, sendId: null })
        expect(parseNewsletterTracking('ticket:123', ['ticket'])).toEqual({ isNewsletter: false, sendId: null })
        expect(parseNewsletterTracking('newsletters', ['newsletters'])).toEqual({ isNewsletter: false, sendId: null })
    })

    test('a malformed send id is dropped (it would be a 500 on the uuid column)', () => {
        expect(parseNewsletterTracking('newsletter:send:not-a-uuid', [])).toEqual({ isNewsletter: true, sendId: null })
        expect(parseNewsletterTracking(`newsletter:send:${SEND_ID}:x`, [])).toEqual({
            isNewsletter: true,
            sendId: null,
        })
    })
})
