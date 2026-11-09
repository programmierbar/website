import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/integrations/heise/podcast/[slug].get'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported, because
// `export default defineEventHandler(...)` runs at load time. vi.hoisted() runs above all imports.
const { directus, config } = vi.hoisted(() => {
    const directus = { getHeisePodcastBySlug: vi.fn() }
    const config = { heiseAccessToken: 'secret' }
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.getRouterParam = (event: any, name: string) => event.params[name]
    g.getQuery = (event: any) => event.query
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useRuntimeConfig = () => config
    g.useAuthenticatedDirectus = () => directus
    return { directus, config }
})

const COVER = { id: 'file-1', title: 'cover', type: 'image/png', width: 3000, height: 2000 }

const PODCAST = {
    slug: 'deep-dive-1',
    published_on: '2026-11-12T05:00:00.000Z',
    youtube_url: 'https://youtu.be/abc',
    heise_titel: 'Titel',
    heise_anriss: '<p>Anriss</p>',
    heise_text: '<p>Text</p>',
    heise_cover: COVER,
    speakers: [],
    members: [],
}

const invoke = (slug = 'deep-dive-1', query: Record<string, unknown> = { token: 'secret' }) =>
    (handler as any)({ params: { slug }, query })

beforeEach(() => {
    directus.getHeisePodcastBySlug.mockReset()
    config.heiseAccessToken = 'secret'
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('GET /api/integrations/heise/podcast/[slug]', () => {
    it('returns the heise content of a released podcast', async () => {
        directus.getHeisePodcastBySlug.mockResolvedValue(PODCAST)

        await expect(invoke()).resolves.toEqual({
            slug: 'deep-dive-1',
            publishedOn: '2026-11-12T05:00:00.000Z',
            youtubeUrl: 'https://youtu.be/abc',
            title: 'Titel',
            anriss: '<p>Anriss</p>',
            text: '<p>Text</p>',
            cover: COVER,
            guests: [],
            hosts: [],
        })
        expect(directus.getHeisePodcastBySlug).toHaveBeenCalledWith('deep-dive-1')
    })

    it('lists guests and hosts by full name in the order set in the CMS', async () => {
        directus.getHeisePodcastBySlug.mockResolvedValue({
            ...PODCAST,
            speakers: [
                { sort: 2, speaker: { academic_title: null, first_name: 'Erika', last_name: 'Mustermann' } },
                { sort: 1, speaker: { academic_title: 'Dr.', first_name: 'Max', last_name: 'Muster' } },
                // A junction row whose speaker is gone comes back as null
                { sort: 3, speaker: null },
            ],
            members: [
                { sort: 2, member: { first_name: 'Garrelt', last_name: 'Mock' } },
                { sort: 1, member: { first_name: 'Dennis', last_name: 'Becker' } },
                // An entry that was not expanded is a bare id
                7,
            ],
        })

        await expect(invoke()).resolves.toMatchObject({
            guests: ['Dr. Max Muster', 'Erika Mustermann'],
            hosts: ['Dennis Becker', 'Garrelt Mock'],
        })
    })

    // The query filters on `heise_enabled`, so an unreleased podcast comes back as no podcast at all
    it('answers 404 for a podcast that is missing or not released to heise', async () => {
        directus.getHeisePodcastBySlug.mockResolvedValue(null)
        await expect(invoke()).rejects.toMatchObject({ statusCode: 404 })
    })

    it.each([
        ['a wrong token', { token: 'wrong' }],
        ['a token that only starts right', { token: 'secret-and-more' }],
        ['no token', {}],
        ['a repeated token parameter', { token: ['secret', 'secret'] }],
    ])('answers 404 without asking the CMS for %s', async (_, query) => {
        await expect(invoke('deep-dive-1', query)).rejects.toMatchObject({ statusCode: 404 })
        expect(directus.getHeisePodcastBySlug).not.toHaveBeenCalled()
    })

    // An empty secret must not turn into "every empty token is valid"
    it('answers 500 when the access token is not configured', async () => {
        config.heiseAccessToken = ''

        await expect(invoke('deep-dive-1', { token: '' })).rejects.toMatchObject({ statusCode: 500 })
        expect(directus.getHeisePodcastBySlug).not.toHaveBeenCalled()
        expect(console.error).toHaveBeenCalled()
    })

    it('answers a generic 500 when the CMS fails', async () => {
        directus.getHeisePodcastBySlug.mockRejectedValue(new Error('403 Forbidden: heise_titel'))

        const error = await invoke().catch((e: any) => e)

        expect(error.statusCode).toBe(500)
        expect(error.message).not.toContain('heise_titel')
        expect(console.error).toHaveBeenCalled()
    })
})
