import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    getProfileUpdateVersionName,
    getSpeakerPortalMode,
    isSpeakerPortalClosed,
    reportSpeakerProfileUpdateFailure,
    saveSpeakerProfileUpdate,
    summarizeError,
} from '../server/utils/speakerProfileUpdate'

describe('speaker portal mode', () => {
    it.each([
        ['update_requested', 'update'],
        ['pending', 'initial'],
        [null, 'initial'],
    ])('%s → %s', (status, mode) => {
        expect(getSpeakerPortalMode(status)).toBe(mode)
    })

    it('is closed only once submitted or approved', () => {
        expect(isSpeakerPortalClosed('submitted')).toBe(true)
        expect(isSpeakerPortalClosed('approved')).toBe(true)
        expect(isSpeakerPortalClosed('update_requested')).toBe(false)
        expect(isSpeakerPortalClosed('pending')).toBe(false)
    })
})

describe('getProfileUpdateVersionName', () => {
    it('uses the German date in Berlin, not the server time zone', () => {
        // 23:30 UTC on 31 Dec is already 1 Jan in Berlin.
        expect(getProfileUpdateVersionName(new Date('2026-12-31T23:30:00.000Z'))).toBe('Profil-Update 01.01.2027')
    })
})

describe('saveSpeakerProfileUpdate', () => {
    const now = new Date('2026-10-20T10:00:00.000Z')
    const speaker = { id: 's1', profile_image: 'file-live', event_image: { id: 'file-event' } }

    function client(existing: { id: string; key: string; name: string | null } | null) {
        return {
            findContentVersion: vi.fn().mockResolvedValue(existing),
            createContentVersion: vi.fn().mockResolvedValue({ id: 'v-new', key: 'profile-update', name: 'x' }),
            saveToContentVersion: vi.fn().mockResolvedValue(undefined),
        }
    }

    it('creates a fresh, dated version and saves exactly the submitted fields into it', async () => {
        const directus = client(null)
        const version = await saveSpeakerProfileUpdate(directus, speaker, { first_name: 'Erika' }, now)

        expect(version.id).toBe('v-new')
        expect(directus.createContentVersion).toHaveBeenCalledWith({
            key: 'profile-update',
            name: 'Profil-Update 20.10.2026',
            collection: 'speakers',
            item: 's1',
        })
        // Nothing to override in a fresh version: images the speaker kept stay out of the delta.
        expect(directus.saveToContentVersion).toHaveBeenCalledWith('v-new', { first_name: 'Erika' })
    })

    it('saves into an existing version without renaming it and resets the images not replaced', async () => {
        const directus = client({ id: 'v1', key: 'profile-update', name: 'Profil-Update 19.10.2026' })
        const version = await saveSpeakerProfileUpdate(
            directus,
            speaker,
            { first_name: 'Erika', profile_image: 'file-new' },
            now
        )

        expect(version).toEqual({ id: 'v1', key: 'profile-update', name: 'Profil-Update 19.10.2026' })
        expect(directus.createContentVersion).not.toHaveBeenCalled()
        expect(directus.saveToContentVersion).toHaveBeenCalledWith('v1', {
            first_name: 'Erika',
            profile_image: 'file-new',
            event_image: 'file-event',
        })
    })

    it('resets a missing live image to null in the fallback', async () => {
        const directus = client({ id: 'v1', key: 'profile-update', name: 'x' })
        await saveSpeakerProfileUpdate(directus, { id: 's1', profile_image: null }, { first_name: 'Erika' }, now)
        expect(directus.saveToContentVersion).toHaveBeenCalledWith('v1', {
            first_name: 'Erika',
            profile_image: null,
            event_image: null,
        })
    })
})

describe('summarizeError', () => {
    it('joins the messages of a Directus SDK error payload', () => {
        expect(summarizeError({ errors: [{ message: 'first' }, { message: 'second' }] })).toBe('first; second')
    })

    it('uses the message of an Error or a string', () => {
        expect(summarizeError(new Error('boom'))).toBe('boom')
        expect(summarizeError('plain')).toBe('plain')
    })

    it('never returns an empty summary', () => {
        expect(summarizeError({})).toBe('Unbekannter Fehler')
        expect(summarizeError(undefined)).toBe('Unbekannter Fehler')
    })

    it('caps the length', () => {
        expect(summarizeError(new Error('x'.repeat(1000)))).toHaveLength(300)
    })
})

describe('reportSpeakerProfileUpdateFailure', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('sends stage and error summary for the speaker', async () => {
        const directus = { reportSpeakerProfileUpdateFailure: vi.fn().mockResolvedValue({ notified: true }) }
        await reportSpeakerProfileUpdateFailure(directus, 's1', 'save_version', new Error('boom'))
        expect(directus.reportSpeakerProfileUpdateFailure).toHaveBeenCalledWith('s1', {
            stage: 'save_version',
            message: 'boom',
        })
    })

    it('logs instead of throwing when the report fails', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const directus = { reportSpeakerProfileUpdateFailure: vi.fn().mockRejectedValue(new Error('timeout')) }
        await expect(
            reportSpeakerProfileUpdateFailure(directus, 's1', 'save_version', new Error('boom'))
        ).resolves.toBeUndefined()
        expect(log).toHaveBeenCalled()
    })
})
