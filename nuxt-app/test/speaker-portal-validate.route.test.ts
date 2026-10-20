import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/speaker-portal/validate.get'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported, because
// `export default defineEventHandler(...)` runs at load time. vi.hoisted() runs above all imports.
const { directus } = vi.hoisted(() => {
    const directus = { getSpeakerByPortalToken: vi.fn() }
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.getQuery = (event: any) => event.query
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = () => directus
    return { directus }
})

const SPEAKER = {
    id: 's1',
    first_name: 'Erika',
    last_name: 'Mustermann',
    occupation: 'CTO bei Beispiel GmbH',
    description: '<p>Erika ist <strong>CTO</strong>.</p>',
    portal_token_expires: '2999-01-01T00:00:00.000Z',
    profile_image: 'file-1',
    event_image: null,
}

const invoke = (token = 't') => (handler as any)({ query: { token } })

beforeEach(() => {
    directus.getSpeakerByPortalToken.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('GET /api/speaker-portal/validate', () => {
    it('opens the form in update mode for a speaker asked to check their profile', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ ...SPEAKER, portal_submission_status: 'update_requested' })

        const result = await invoke()

        expect(result.mode).toBe('update')
        expect(result.speaker).toMatchObject({
            id: 's1',
            description: 'Erika ist **CTO**.',
            profile_image: 'file-1',
            event_image: null,
        })
    })

    it('stays in initial mode for an invited speaker', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ ...SPEAKER, portal_submission_status: 'pending' })
        await expect(invoke()).resolves.toMatchObject({ mode: 'initial' })
    })

    it.each(['submitted', 'approved'])('answers 409 once the speaker is %s', async (status) => {
        directus.getSpeakerByPortalToken.mockResolvedValue({ ...SPEAKER, portal_submission_status: status })
        await expect(invoke()).rejects.toMatchObject({ statusCode: 409 })
    })

    it('answers 410 for an expired update link', async () => {
        directus.getSpeakerByPortalToken.mockResolvedValue({
            ...SPEAKER,
            portal_submission_status: 'update_requested',
            portal_token_expires: '2000-01-01T00:00:00.000Z',
        })
        await expect(invoke()).rejects.toMatchObject({ statusCode: 410 })
    })
})
