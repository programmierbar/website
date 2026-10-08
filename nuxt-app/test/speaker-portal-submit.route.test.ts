import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/speaker-portal/submit.post'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported, because
// `export default defineEventHandler(...)` runs at load time. vi.hoisted() runs above all imports.
const { directus, useAuthenticatedDirectus } = vi.hoisted(() => {
    const directus = {
        getSpeakerByPortalToken: vi.fn(),
        uploadFile: vi.fn(),
        updateSpeaker: vi.fn(),
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
})
