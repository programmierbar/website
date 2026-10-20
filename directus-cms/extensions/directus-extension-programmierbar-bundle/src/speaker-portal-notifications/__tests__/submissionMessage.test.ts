import { describe, expect, test } from '@jest/globals'
import {
    buildSubmissionSlackMessage,
    createProfileUpdateTracker,
    findProfileUpdateKeys,
    PROFILE_UPDATE_MARK_TTL_MS,
} from '../util/submissionMessage.ts'

describe('createProfileUpdateTracker', () => {
    test('a mark is consumed exactly once', () => {
        const tracker = createProfileUpdateTracker()
        tracker.mark('s1')

        expect(tracker.consume('s1')).toBe(true)
        expect(tracker.consume('s1')).toBe(false)
        expect(tracker.consume('s2')).toBe(false)
    })

    test('numeric and string keys are the same speaker', () => {
        const tracker = createProfileUpdateTracker()
        tracker.mark(7)
        expect(tracker.consume('7')).toBe(true)
    })

    test('a mark whose write never completed expires', () => {
        let now = 1_000_000
        const tracker = createProfileUpdateTracker(() => now)
        tracker.mark('s1')

        now += PROFILE_UPDATE_MARK_TTL_MS + 1
        expect(tracker.consume('s1')).toBe(false)
    })
})

describe('findProfileUpdateKeys', () => {
    test('picks only speakers that were asked for an update', () => {
        expect(
            findProfileUpdateKeys([
                { id: 'a', portal_submission_status: 'update_requested' },
                { id: 'b', portal_submission_status: 'pending' },
                { id: 'c', portal_submission_status: null },
            ])
        ).toEqual(['a'])
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
            isProfileUpdate: true,
            versionName: 'Profil-Update 20.10.2026',
        })

        expect(text).toContain('Profil-Update')
        expect(text).toContain('„Profil-Update 20.10.2026“ (profile-update)')
        expect(text).toContain('NICHT live')
        expect(text).toContain(`${itemUrl}?version=profile-update`)
    })

    test('still links the version by key when its name is unknown', () => {
        const text = buildSubmissionSlackMessage({ speakerName: 'Erika', itemUrl, isProfileUpdate: true })
        expect(text).toContain('„profile-update“')
        expect(text).toContain(`${itemUrl}?version=profile-update`)
    })
})
