import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/speaker-portal/submit.post'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported, because
// `export default defineEventHandler(...)` runs at load time. vi.hoisted() runs above all imports.
const { directus, useAuthenticatedDirectus } = vi.hoisted(() => {
    const directus = {
        getSpeakerByPortalToken: vi.fn(),
        uploadFile: vi.fn(),
        updateSpeaker: vi.fn(),
        findContentVersion: vi.fn(),
        createContentVersion: vi.fn(),
        saveToContentVersion: vi.fn(),
        reportSpeakerProfileUpdateFailure: vi.fn(),
    }
    const useAuthenticatedDirectus = vi.fn(() => directus)
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readMultipartFormData = async (event: any) => {
        if (event.multipartError) throw event.multipartError
        return event.parts
    }
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = useAuthenticatedDirectus
    return { directus, useAuthenticatedDirectus }
})

const validData = {
    academic_title: '',
    first_name: 'Erika',
    last_name: 'Mustermann',
    occupation: 'Head of Engineering at Beispiel GmbH',
    description: 'Erika Mustermann arbeitet als Head of Engineering.',
    website_url: '',
    linkedin_url: '',
    twitter_url: '',
    bluesky_url: '',
    github_url: '',
    instagram_url: '',
    youtube_url: '',
    mastodon_url: '',
}

const part = (name: string, value: string) => ({ name, data: Buffer.from(value) })
const invoke = (parts: unknown, extra: Record<string, unknown> = {}) => (handler as any)({ parts, ...extra })

beforeEach(() => {
    Object.values(directus).forEach((fn) => fn.mockReset())
    useAuthenticatedDirectus.mockReset().mockImplementation(() => directus)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /api/speaker-portal/submit', () => {
    it('answers an unreadable multipart body with a German 400', async () => {
        await expect(invoke(undefined, { multipartError: new Error('boundary not found') })).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Bitte lade die Seite neu'),
        })
    })

    it('answers a data field that is not JSON with a 400 instead of a SyntaxError', async () => {
        await expect(invoke([part('token', 't'), part('data', '{not json')])).rejects.toMatchObject({
            statusCode: 400,
        })
    })

    it('reports schema problems in German', async () => {
        const data = { ...validData, website_url: 'not a url' }
        await expect(invoke([part('token', 't'), part('data', JSON.stringify(data))])).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('„Website“'),
        })
    })

    it('reports a missing required field in German, not with the Zod default', async () => {
        const { first_name: _omitted, ...data } = validData
        await expect(invoke([part('token', 't'), part('data', JSON.stringify(data))])).rejects.toMatchObject({
            statusCode: 400,
            message: 'Bitte fülle das Feld „Vorname“ aus.',
        })
    })

    it('hides an internal Directus error behind a generic 500 and logs it', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ id: 's1', portal_submission_status: 'pending' })
        directus.updateSpeaker.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'))
        const error = await invoke([part('token', 't'), part('data', JSON.stringify(validData))]).catch((e: any) => e)
        expect(error).toMatchObject({ statusCode: 500 })
        expect(error.message).not.toContain('SQLITE')
        expect(console.error).toHaveBeenCalled()
        // A first submission has no Content Version step to report.
        expect(directus.reportSpeakerProfileUpdateFailure).not.toHaveBeenCalled()
    })

    it('hides a configuration error behind the same generic 500', async () => {
        useAuthenticatedDirectus.mockImplementation(() => {
            throw Object.assign(new Error('NUXT_DIRECTUS_API_TOKEN not configured'), { statusCode: 500 })
        })
        const error = await invoke([part('token', 't'), part('data', JSON.stringify(validData))]).catch((e: any) => e)
        expect(error).toMatchObject({ statusCode: 500 })
        expect(error.message).not.toContain('NUXT_DIRECTUS_API_TOKEN')
    })

    it('passes the deliberate 409 for an already submitted speaker through', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ id: 's1', portal_submission_status: 'submitted' })
        await expect(invoke([part('token', 't'), part('data', JSON.stringify(validData))])).rejects.toMatchObject({
            statusCode: 409,
        })
        expect(directus.updateSpeaker).not.toHaveBeenCalled()
    })

    describe('rejects a bio that has no text left once converted', () => {
        // The schema only sees the Markdown. Saving an empty bio would still mark the submission
        // complete and burn the token, so the speaker could not fix it.
        it.each([
            ['only an image', '![x](https://example.com/a.png)'],
            ['only whitespace', '   \n\n  '],
            ['only a script', '<script>alert(1)</script>'],
            ['only markup and entities', '<img src=x>&nbsp;**&#32;**'],
            ['only invisible characters', '\u200b\u00a0\u2060'],
        ])('%s', async (_case, description) => {
            directus.getSpeakerByPortalToken.mockResolvedValue({ id: 's1', portal_submission_status: 'pending' })
            const data = { ...validData, description }
            const parts = [
                part('token', 't'),
                part('data', JSON.stringify(data)),
                { name: 'profile_image', filename: 'a.jpg', type: 'image/jpeg', data: Buffer.from('jpg') },
            ]
            await expect(invoke(parts)).rejects.toMatchObject({
                statusCode: 400,
                message: expect.stringContaining('„Bio / Beschreibung“'),
            })
            expect(directus.uploadFile).not.toHaveBeenCalled()
            expect(directus.updateSpeaker).not.toHaveBeenCalled()
        })
    })

    it('stores the bio as sanitised HTML', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ id: 's1', portal_submission_status: 'pending' })
        directus.updateSpeaker.mockResolvedValue({})
        const data = { ...validData, description: 'Erika ist **CTO**. ![x](https://example.com/a.png)' }
        await invoke([part('token', 't'), part('data', JSON.stringify(data))])
        expect(directus.updateSpeaker).toHaveBeenCalledWith(
            's1',
            expect.objectContaining({ description: '<p>Erika ist <strong>CTO</strong>. </p>' })
        )
    })

    it('stores the submission and invalidates the token', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ id: 's1', portal_submission_status: 'pending' })
        directus.updateSpeaker.mockResolvedValue({})
        await expect(invoke([part('token', 't'), part('data', JSON.stringify(validData))])).resolves.toMatchObject({
            success: true,
        })
        expect(directus.updateSpeaker).toHaveBeenCalledWith(
            's1',
            expect.objectContaining({ portal_submission_status: 'submitted', portal_token: null })
        )
    })

    describe('profile update (status update_requested)', () => {
        const image = { name: 'profile_image', filename: 'a.jpg', type: 'image/jpeg', data: Buffer.from('jpg') }

        beforeEach(() => {
            directus.getSpeakerByPortalToken.mockResolvedValue({
                id: 's1',
                portal_submission_status: 'update_requested',
            })
            directus.uploadFile.mockResolvedValue({ id: 'file-new' })
            directus.updateSpeaker.mockResolvedValue({})
            directus.saveToContentVersion.mockResolvedValue({})
            directus.reportSpeakerProfileUpdateFailure.mockResolvedValue({ notified: true })
        })

        it('saves the profile into a new Content Version and writes only status and token live', async () => {
            directus.findContentVersion.mockResolvedValue(null)
            directus.createContentVersion.mockResolvedValue({ id: 'v1', key: 'profile-update', name: 'x' })

            await expect(
                invoke([part('token', 't'), part('data', JSON.stringify(validData)), image])
            ).resolves.toMatchObject({ success: true, mode: 'update' })

            expect(directus.findContentVersion).toHaveBeenCalledWith('speakers', 's1', 'profile-update')
            expect(directus.createContentVersion).toHaveBeenCalledWith({
                key: 'profile-update',
                name: expect.stringMatching(/^Profil-Update \d{2}\.\d{2}\.\d{4}$/),
                collection: 'speakers',
                item: 's1',
            })
            expect(directus.saveToContentVersion).toHaveBeenCalledWith(
                'v1',
                expect.objectContaining({
                    first_name: 'Erika',
                    occupation: 'Head of Engineering at Beispiel GmbH',
                    description: '<p>Erika Mustermann arbeitet als Head of Engineering.</p>',
                    website_url: null,
                    profile_image: 'file-new',
                })
            )
            const delta = directus.saveToContentVersion.mock.calls[0]![1]
            expect(delta).not.toHaveProperty('portal_submission_status')
            expect(delta).not.toHaveProperty('portal_token')
            expect(delta).not.toHaveProperty('event_image')

            // The live item gets nothing but the completion, after the version was saved.
            expect(directus.updateSpeaker).toHaveBeenCalledTimes(1)
            expect(directus.updateSpeaker).toHaveBeenCalledWith('s1', {
                portal_submission_status: 'submitted',
                portal_token: null,
            })
            expect(directus.saveToContentVersion.mock.invocationCallOrder[0]!).toBeLessThan(
                directus.updateSpeaker.mock.invocationCallOrder[0]!
            )
        })

        it('saves into a version left from an earlier attempt, resetting images not replaced now', async () => {
            // The CMS deletes earlier versions when it sends the request, so an existing one comes
            // from a failed attempt in this request. Its delta may hold that attempt's image.
            directus.getSpeakerByPortalToken.mockResolvedValue({
                id: 's1',
                portal_submission_status: 'update_requested',
                profile_image: 'file-live-profile',
                event_image: null,
            })
            directus.findContentVersion.mockResolvedValue({
                id: 'v-earlier',
                key: 'profile-update',
                name: 'Profil-Update 01.01.2020',
            })

            await invoke([part('token', 't'), part('data', JSON.stringify(validData))])

            expect(directus.createContentVersion).not.toHaveBeenCalled()
            expect(directus.saveToContentVersion).toHaveBeenCalledWith(
                'v-earlier',
                expect.objectContaining({ first_name: 'Erika', profile_image: 'file-live-profile', event_image: null })
            )
        })

        it('a replacement image uploaded now wins over the live one in the fallback', async () => {
            directus.getSpeakerByPortalToken.mockResolvedValue({
                id: 's1',
                portal_submission_status: 'update_requested',
                profile_image: 'file-live-profile',
                event_image: 'file-live-event',
            })
            directus.findContentVersion.mockResolvedValue({ id: 'v-earlier', key: 'profile-update', name: 'x' })

            await invoke([part('token', 't'), part('data', JSON.stringify(validData)), image])

            expect(directus.saveToContentVersion).toHaveBeenCalledWith(
                'v-earlier',
                expect.objectContaining({ profile_image: 'file-new', event_image: 'file-live-event' })
            )
        })

        it('keeps the token usable when the version cannot be saved', async () => {
            // e.g. Content Versioning switched off: Directus answers 422 on POST /versions.
            directus.findContentVersion.mockResolvedValue(null)
            directus.createContentVersion.mockRejectedValue(
                new Error('Content Versioning is not enabled for collection "speakers"')
            )

            const error = await invoke([part('token', 't'), part('data', JSON.stringify(validData))]).catch(
                (e: any) => e
            )

            expect(error).toMatchObject({ statusCode: 500 })
            expect(error.message).not.toContain('Versioning')
            expect(directus.updateSpeaker).not.toHaveBeenCalled()
            expect(console.error).toHaveBeenCalled()
        })

        it('reports a failed version save to the team (via the CMS) and still answers the same 500', async () => {
            directus.findContentVersion.mockResolvedValue({ id: 'v1', key: 'profile-update', name: 'x' })
            // The Directus SDK rejects with its error payload, not an Error.
            directus.saveToContentVersion.mockRejectedValue({
                errors: [{ message: "You don't have permission to access this.", extensions: { code: 'FORBIDDEN' } }],
            })

            const error = await invoke([part('token', 't'), part('data', JSON.stringify(validData))]).catch(
                (e: any) => e
            )

            expect(error).toMatchObject({
                statusCode: 500,
                message: 'Beim Speichern deiner Informationen ist leider ein Fehler aufgetreten.',
            })
            expect(directus.reportSpeakerProfileUpdateFailure).toHaveBeenCalledTimes(1)
            expect(directus.reportSpeakerProfileUpdateFailure).toHaveBeenCalledWith('s1', {
                stage: 'save_version',
                message: "You don't have permission to access this.",
            })
            expect(directus.updateSpeaker).not.toHaveBeenCalled()
        })

        it('a failing report is logged and does not change the answer to the speaker', async () => {
            directus.findContentVersion.mockResolvedValue(null)
            directus.createContentVersion.mockRejectedValue(new Error('Content Versioning is not enabled'))
            const reportError = new Error('CMS unreachable')
            directus.reportSpeakerProfileUpdateFailure.mockRejectedValue(reportError)

            const error = await invoke([part('token', 't'), part('data', JSON.stringify(validData))]).catch(
                (e: any) => e
            )

            expect(error).toMatchObject({
                statusCode: 500,
                message: 'Beim Speichern deiner Informationen ist leider ein Fehler aufgetreten.',
            })
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('could not report'), reportError)
            expect(directus.updateSpeaker).not.toHaveBeenCalled()
        })

        it('does not report anything when the version was saved', async () => {
            directus.findContentVersion.mockResolvedValue(null)
            directus.createContentVersion.mockResolvedValue({ id: 'v1', key: 'profile-update', name: 'x' })
            await invoke([part('token', 't'), part('data', JSON.stringify(validData))])
            expect(directus.reportSpeakerProfileUpdateFailure).not.toHaveBeenCalled()
        })
    })

    it('writes a first submission straight to the live item, without a version', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ id: 's1', portal_submission_status: 'pending' })
        directus.updateSpeaker.mockResolvedValue({})

        await expect(invoke([part('token', 't'), part('data', JSON.stringify(validData))])).resolves.toMatchObject({
            mode: 'initial',
        })

        expect(directus.findContentVersion).not.toHaveBeenCalled()
        expect(directus.saveToContentVersion).not.toHaveBeenCalled()
        expect(directus.updateSpeaker).toHaveBeenCalledWith(
            's1',
            expect.objectContaining({ first_name: 'Erika', portal_submission_status: 'submitted', portal_token: null })
        )
    })
})
