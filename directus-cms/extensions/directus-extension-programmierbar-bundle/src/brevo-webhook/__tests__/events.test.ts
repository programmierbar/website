import { describe, expect, test } from '@jest/globals'
import { decide, normalizeEvents } from '../events.ts'

const SEND_ID = '6f1c2a5e-0000-4000-8000-0000000000aa'
const NEWSLETTER = { 'X-Mailin-custom': `newsletter:send:${SEND_ID}`, tags: ['newsletter'] }
const TICKET = { 'X-Mailin-custom': '', tags: [] }

describe('normalizeEvents', () => {
    test('accepts a single event and a batched array', () => {
        expect(normalizeEvents({ event: 'spam' })).toEqual([{ event: 'spam' }])
        expect(normalizeEvents([{ event: 'spam' }, { event: 'hard_bounce' }])).toHaveLength(2)
    })

    test('drops anything that is not an event object', () => {
        expect(normalizeEvents(undefined)).toEqual([])
        expect(normalizeEvents('x')).toEqual([])
        expect(normalizeEvents([null, 1, [], { event: 'spam' }])).toEqual([{ event: 'spam' }])
    })
})

describe('decide', () => {
    test('hard bounce and invalid address bounce the subscriber, on any mail', () => {
        for (const event of ['hard_bounce', 'invalid_email']) {
            expect(decide({ event, email: 'a@b.de', ...TICKET })).toMatchObject({ transition: 'bounced', sendId: null })
            expect(decide({ event, email: 'a@b.de', ...NEWSLETTER })).toMatchObject({
                transition: 'bounced',
                sendId: SEND_ID,
            })
        }
    })

    test('a spam complaint only counts for newsletter mails', () => {
        expect(decide({ event: 'spam', email: 'a@b.de', ...NEWSLETTER })).toMatchObject({
            transition: 'complained',
            sendId: SEND_ID,
            note: 'Brevo: spam',
        })
        expect(decide({ event: 'spam', email: 'a@b.de', ...TICKET })).toMatchObject({ transition: null })
        expect(decide({ event: 'spam', email: 'a@b.de', 'X-Mailin-custom': 'newsletter:double-opt-in' })).toMatchObject(
            { transition: 'complained', sendId: null }
        )
    })

    test("Brevo's unsubscribe only counts for newsletter mails; its tag may be a stringified array", () => {
        expect(decide({ event: 'unsubscribed', email: 'a@b.de', tag: '["newsletter"]' })).toMatchObject({
            transition: 'unsubscribed',
        })
        expect(decide({ event: 'unsubscribed', email: 'a@b.de', tag: '["transactionalTag"]' })).toMatchObject({
            transition: null,
        })
    })

    test('blocked is only noted on the send row', () => {
        expect(decide({ event: 'blocked', email: 'a@b.de', ...NEWSLETTER })).toMatchObject({
            transition: null,
            sendId: SEND_ID,
            note: 'Brevo: blocked',
        })
    })

    test('soft bounces and other events are ignored entirely', () => {
        for (const event of ['soft_bounce', 'deferred', 'delivered', 'opened', 'click', 'request', '']) {
            expect(decide({ event, email: 'a@b.de', ...NEWSLETTER })).toMatchObject({ transition: null, sendId: null })
        }
    })

    test('normalises the address like the website stores it and keeps the reason', () => {
        expect(decide({ event: 'hard_bounce', email: '  Leser@Example.DE ', reason: 'user unknown' })).toMatchObject({
            email: 'leser@example.de',
            note: 'Brevo: hard_bounce (user unknown)',
        })
        expect(decide({ event: 'hard_bounce' })).toMatchObject({ email: '' })
    })
})
