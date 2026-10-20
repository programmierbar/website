import { describe, expect, it, vi } from 'vitest'
import {
    getProfileUpdateVersionName,
    getSpeakerPortalMode,
    isSpeakerPortalClosed,
    saveSpeakerProfileUpdate,
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

    function client(existing: { id: string; key: string; name: string | null } | null) {
        return {
            findContentVersion: vi.fn().mockResolvedValue(existing),
            createContentVersion: vi.fn().mockResolvedValue({ id: 'v-new', key: 'profile-update', name: 'x' }),
            renameContentVersion: vi.fn().mockResolvedValue(undefined),
            saveToContentVersion: vi.fn().mockResolvedValue(undefined),
        }
    }

    it('does not rename a version that already carries today’s name', async () => {
        const directus = client({ id: 'v1', key: 'profile-update', name: 'Profil-Update 20.10.2026' })
        const version = await saveSpeakerProfileUpdate(directus, 's1', { first_name: 'Erika' }, now)

        expect(version.id).toBe('v1')
        expect(directus.renameContentVersion).not.toHaveBeenCalled()
        expect(directus.createContentVersion).not.toHaveBeenCalled()
        expect(directus.saveToContentVersion).toHaveBeenCalledWith('v1', { first_name: 'Erika' })
    })

    it('creates the version on the first update', async () => {
        const directus = client(null)
        const version = await saveSpeakerProfileUpdate(directus, 's1', { first_name: 'Erika' }, now)

        expect(version.id).toBe('v-new')
        expect(directus.createContentVersion).toHaveBeenCalledWith({
            key: 'profile-update',
            name: 'Profil-Update 20.10.2026',
            collection: 'speakers',
            item: 's1',
        })
        expect(directus.saveToContentVersion).toHaveBeenCalledWith('v-new', { first_name: 'Erika' })
    })
})
