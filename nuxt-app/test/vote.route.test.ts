import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VOTE_COOLDOWN_MINUTES } from '../config'
import voteHandler from '../server/api/vote.post'

// Nuxt/Nitro auto-imports must exist before the handler is imported (its
// `defineEventHandler(...)` runs at load time); vi.hoisted runs first.
const directus = vi.hoisted(() => {
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readBody = async (event: any) => event.body ?? {}
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    return {
        getPodcastBySlug: vi.fn(),
        getRecentRatingByIP: vi.fn(),
        updateRatingVote: vi.fn(),
        createRating: vi.fn(),
    }
})

vi.mock('~/composables/useDirectus', () => ({ useDirectus: () => directus }))
vi.mock('~/config', () => import('../config'))

const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const PODCAST = { id: 'podcast-1', slug: 'folge-1' }

const vote = (direction: 'up' | 'down', headers: Record<string, string | undefined> = { 'user-agent': BROWSER_UA }) =>
    (voteHandler as any)({
        body: { slug: PODCAST.slug, direction },
        node: { req: { headers: { 'x-forwarded-for': '203.0.113.7', ...headers }, socket: {} } },
    })

beforeEach(() => {
    Object.values(directus).forEach((fn) => fn.mockReset())
    directus.getPodcastBySlug.mockResolvedValue(PODCAST)
    directus.getRecentRatingByIP.mockResolvedValue(null)
    directus.createRating.mockResolvedValue({ id: 'rating-new' })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /api/vote', () => {
    it('stores a vote from a browser', async () => {
        await expect(vote('up')).resolves.toEqual({ id: 'rating-new' })
        expect(directus.createRating).toHaveBeenCalledWith('up', PODCAST, {
            ip: '203.0.113.7',
            user_agent: BROWSER_UA,
        })
    })

    it.each([
        'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        undefined,
    ])('answers with success but stores nothing for user agent %s', async (userAgent) => {
        await expect(vote('up', { 'user-agent': userAgent })).resolves.toEqual({ id: undefined })
        expect(directus.getPodcastBySlug).not.toHaveBeenCalled()
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('looks for an earlier vote from the same IP within the cooldown', async () => {
        const now = Date.parse('2026-10-20T08:00:00Z')
        vi.spyOn(Date, 'now').mockReturnValue(now)
        await vote('up')
        expect(directus.getRecentRatingByIP).toHaveBeenCalledWith(
            PODCAST,
            '203.0.113.7',
            new Date(now - VOTE_COOLDOWN_MINUTES * 60 * 1000)
        )
    })

    it('replaces an earlier opposite vote within the cooldown instead of adding one', async () => {
        directus.getRecentRatingByIP.mockResolvedValue({ id: 'rating-old', up_or_down: 'up' })
        await expect(vote('down')).resolves.toEqual({ id: 'rating-old' })
        expect(directus.updateRatingVote).toHaveBeenCalledWith({ id: 'rating-old', up_or_down: 'up' }, 'down')
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('counts a repeated vote within the cooldown once', async () => {
        directus.getRecentRatingByIP.mockResolvedValue({ id: 'rating-old', up_or_down: 'up' })
        await expect(vote('up')).resolves.toEqual({ id: 'rating-old' })
        expect(directus.updateRatingVote).not.toHaveBeenCalled()
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('answers 500 when the earlier vote cannot be replaced', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        directus.getRecentRatingByIP.mockResolvedValue({ id: 'rating-old', up_or_down: 'up' })
        directus.updateRatingVote.mockRejectedValue(new Error('forbidden'))
        await expect(vote('down')).rejects.toMatchObject({ statusCode: 500 })
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('answers 500 when the lookup fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        directus.getRecentRatingByIP.mockRejectedValue(new Error('network'))
        await expect(vote('up')).rejects.toMatchObject({ statusCode: 500 })
        expect(directus.createRating).not.toHaveBeenCalled()
    })
})
