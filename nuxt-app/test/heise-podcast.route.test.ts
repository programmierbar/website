import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/integrations/heise/podcast/[slug].get'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported, because
// `export default defineEventHandler(...)` runs at load time. vi.hoisted() runs above all imports.
const { directus } = vi.hoisted(() => {
    const directus = { getHeisePodcastBySlug: vi.fn() }
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.getRouterParam = (event: any, name: string) => event.params[name]
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = () => directus
    return { directus }
})

const COVER = { id: 'file-1', title: 'cover', type: 'image/png', width: 3000, height: 2000 }

const invoke = (slug = 'deep-dive-1') => (handler as any)({ params: { slug } })

beforeEach(() => {
    directus.getHeisePodcastBySlug.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('GET /api/integrations/heise/podcast/[slug]', () => {
    it('returns the heise content of a released podcast', async () => {
        directus.getHeisePodcastBySlug.mockResolvedValue({
            slug: 'deep-dive-1',
            youtube_url: 'https://youtu.be/abc',
            heise_titel: 'Titel',
            heise_anriss: '<p>Anriss</p>',
            heise_text: '<p>Text</p>',
            heise_cover: COVER,
        })

        await expect(invoke()).resolves.toEqual({
            slug: 'deep-dive-1',
            youtubeUrl: 'https://youtu.be/abc',
            title: 'Titel',
            anriss: '<p>Anriss</p>',
            text: '<p>Text</p>',
            cover: COVER,
        })
        expect(directus.getHeisePodcastBySlug).toHaveBeenCalledWith('deep-dive-1')
    })

    // The query filters on `heise_enabled`, so an unreleased podcast comes back as no podcast at all
    it('answers 404 for a podcast that is missing or not released to heise', async () => {
        directus.getHeisePodcastBySlug.mockResolvedValue(null)
        await expect(invoke()).rejects.toMatchObject({ statusCode: 404 })
    })

    it('answers a generic 500 when the CMS fails', async () => {
        directus.getHeisePodcastBySlug.mockRejectedValue(new Error('403 Forbidden: heise_titel'))

        const error = await invoke().catch((e: any) => e)

        expect(error.statusCode).toBe(500)
        expect(error.message).not.toContain('heise_titel')
        expect(console.error).toHaveBeenCalled()
    })
})
