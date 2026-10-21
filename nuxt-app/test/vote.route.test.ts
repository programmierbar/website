import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VOTE_COOLDOWN_MINUTES } from '../config'
import voteHandler from '../server/api/vote.post'

// Nuxt/Nitro auto-imports must exist before the handler is imported (its
// `defineEventHandler(...)` runs at load time); vi.hoisted runs first.
const { directus, authenticated } = vi.hoisted(() => {
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readBody = async (event: any) => event.body ?? {}
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    return {
        // The public client: the CMS's public role may read podcasts and create ratings.
        directus: { getPodcastBySlug: vi.fn(), createRating: vi.fn() },
        // The token client: the public role may not read a rating's `ip` or `target`, nor update one.
        authenticated: { getRecentRatingByIPHash: vi.fn(), updateRatingVote: vi.fn() },
    }
})

vi.mock('~/composables/useDirectus', () => ({ useDirectus: () => directus }))
vi.mock('../server/utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../server/utils')>()),
    useAuthenticatedDirectus: () => authenticated,
}))
vi.mock('~/config', () => import('../config'))

const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const PODCAST = { id: 'podcast-1', slug: 'folge-1' }
// anonymizeAndHashIP('203.0.113.7'): the SHA-256 of '203.0.0.0', the address with its last two octets
// zeroed. Stored ratings carry this value, so a change here would split the cooldown across a deploy.
const IP_HASH = '2172243fafcf160d8b3bf50e372877cfd3700fe0f59db1c795e26b2201cdb65f'

const vote = (direction: 'up' | 'down', headers: Record<string, string | undefined> = { 'user-agent': BROWSER_UA }) =>
    (voteHandler as any)({
        body: { slug: PODCAST.slug, direction },
        node: { req: { headers: { 'x-forwarded-for': '203.0.113.7', ...headers }, socket: {} } },
    })

beforeEach(() => {
    for (const fn of [...Object.values(directus), ...Object.values(authenticated)]) fn.mockReset()
    directus.getPodcastBySlug.mockResolvedValue(PODCAST)
    authenticated.getRecentRatingByIPHash.mockResolvedValue(null)
    directus.createRating.mockResolvedValue({ id: 'rating-new' })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /api/vote', () => {
    it('stores a vote from a browser', async () => {
        await expect(vote('up')).resolves.toEqual({ id: 'rating-new' })
        expect(directus.createRating).toHaveBeenCalledWith('up', PODCAST, {
            ip: IP_HASH,
            user_agent: BROWSER_UA,
        })
    })

    it('stores a vote without an IP, and skips the cooldown, when the IP is invalid', async () => {
        await expect(vote('up', { 'user-agent': BROWSER_UA, 'x-forwarded-for': 'not-an-ip' })).resolves.toEqual({
            id: 'rating-new',
        })
        expect(authenticated.getRecentRatingByIPHash).not.toHaveBeenCalled()
        expect(directus.createRating).toHaveBeenCalledWith('up', PODCAST, { user_agent: BROWSER_UA })
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

    it('looks for an earlier vote from the same IP hash within the cooldown', async () => {
        const now = Date.parse('2026-10-20T08:00:00Z')
        vi.spyOn(Date, 'now').mockReturnValue(now)
        await vote('up')
        expect(authenticated.getRecentRatingByIPHash).toHaveBeenCalledWith(
            PODCAST,
            IP_HASH,
            new Date(now - VOTE_COOLDOWN_MINUTES * 60 * 1000)
        )
    })

    it('replaces an earlier opposite vote within the cooldown instead of adding one', async () => {
        authenticated.getRecentRatingByIPHash.mockResolvedValue({ id: 'rating-old', up_or_down: 'up' })
        await expect(vote('down')).resolves.toEqual({ id: 'rating-old' })
        expect(authenticated.updateRatingVote).toHaveBeenCalledWith({ id: 'rating-old', up_or_down: 'up' }, 'down')
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('counts a repeated vote within the cooldown once', async () => {
        authenticated.getRecentRatingByIPHash.mockResolvedValue({ id: 'rating-old', up_or_down: 'up' })
        await expect(vote('up')).resolves.toEqual({ id: 'rating-old' })
        expect(authenticated.updateRatingVote).not.toHaveBeenCalled()
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('answers 500 when the earlier vote cannot be replaced', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        authenticated.getRecentRatingByIPHash.mockResolvedValue({ id: 'rating-old', up_or_down: 'up' })
        authenticated.updateRatingVote.mockRejectedValue(new Error('forbidden'))
        await expect(vote('down')).rejects.toMatchObject({ statusCode: 500 })
        expect(directus.createRating).not.toHaveBeenCalled()
    })

    it('answers 500 when the lookup fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        authenticated.getRecentRatingByIPHash.mockRejectedValue(new Error('network'))
        await expect(vote('up')).rejects.toMatchObject({ statusCode: 500 })
        expect(directus.createRating).not.toHaveBeenCalled()
    })
})
