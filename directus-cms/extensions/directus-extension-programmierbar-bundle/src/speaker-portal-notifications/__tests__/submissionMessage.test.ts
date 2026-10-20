import { describe, expect, test } from '@jest/globals'
import { buildSubmissionSlackMessage, isFreshProfileUpdateVersion } from '../util/submissionMessage.ts'

const NOW = new Date('2026-10-20T12:00:00.000Z')
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000).toISOString()

describe('isFreshProfileUpdateVersion', () => {
    test('a version saved moments ago belongs to this submission', () => {
        expect(
            isFreshProfileUpdateVersion({ key: 'profile-update', name: null, date_updated: minutesAgo(1) }, NOW)
        ).toBe(true)
    })

    test('falls back to date_created for a version that was never updated', () => {
        expect(
            isFreshProfileUpdateVersion(
                { key: 'profile-update', name: null, date_created: minutesAgo(2), date_updated: null },
                NOW
            )
        ).toBe(true)
    })

    test('an old version (e.g. kept after promoting) does not turn a first submission into an update', () => {
        expect(
            isFreshProfileUpdateVersion({ key: 'profile-update', name: null, date_updated: minutesAgo(60) }, NOW)
        ).toBe(false)
    })

    test('no version, no update', () => {
        expect(isFreshProfileUpdateVersion(null, NOW)).toBe(false)
        expect(isFreshProfileUpdateVersion({ key: 'profile-update', name: null }, NOW)).toBe(false)
    })
})

describe('buildSubmissionSlackMessage', () => {
    const itemUrl = 'https://admin.example.com/admin/content/speakers/speaker-1'

    test('keeps the existing message for a first submission', () => {
        expect(buildSubmissionSlackMessage({ speakerName: 'Erika Mustermann', podcastTitle: 'Folge 1', itemUrl })).toBe(
            `:white_check_mark: *Speaker Portal*: Erika Mustermann hat die Informationen für "Folge 1" eingereicht. ${itemUrl}`
        )
    })

    test('calls a profile update by its name and links to the version', () => {
        const text = buildSubmissionSlackMessage({
            speakerName: 'Erika Mustermann',
            itemUrl,
            profileUpdateVersion: { key: 'profile-update', name: 'Profil-Update 20.10.2026' },
        })

        expect(text).toContain('Profil-Update')
        expect(text).toContain('„Profil-Update 20.10.2026“ (profile-update)')
        expect(text).toContain('NICHT live')
        expect(text).toContain(`${itemUrl}?version=profile-update`)
    })
})
