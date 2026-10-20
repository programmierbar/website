import { describe, expect, test } from '@jest/globals'
import { confirmText, describeTestSendResult } from '../test-send-state.ts'

describe('confirmText', () => {
    test('names the recipient', () => {
        expect(confirmText('admin@example.de')).toContain('an deine Adresse admin@example.de')
    })

    test('falls back to a description when the address could not be loaded', () => {
        expect(confirmText(null)).toContain('an die E-Mail-Adresse deines Benutzerkontos')
    })
})

describe('describeTestSendResult', () => {
    test('confirms recipient and subject and explains the unsubscribe link', () => {
        const subscriber = describeTestSendResult({
            recipient: 'a@b.de',
            subject: '[TEST] X',
            unsubscribe: 'subscriber',
            hidden: [],
            warnings: [],
        })
        expect(subscriber.message).toContain('„[TEST] X“ an a@b.de')
        expect(subscriber.message).toContain('dein echter')
        expect(subscriber.notes).toEqual([])

        const test = describeTestSendResult({
            recipient: 'a@b.de',
            subject: 'S',
            unsubscribe: 'test',
            hidden: [],
            warnings: [],
        })
        expect(test.message).toContain('Test-Link ohne Wirkung')
    })

    test('lists hidden entries and warnings as notes', () => {
        const view = describeTestSendResult({
            recipient: 'a@b.de',
            subject: 'S',
            unsubscribe: 'test',
            hidden: [{ collection: 'meetups', title: 'Geheim', status: 'draft' }],
            warnings: ['Podcast-Block übersprungen: keine veröffentlichte Folge'],
        })
        expect(view.notes).toEqual([
            'Ausgeblendet, weil nicht veröffentlicht: Meetup „Geheim“ (draft)',
            'Podcast-Block übersprungen: keine veröffentlichte Folge',
        ])
    })
})
