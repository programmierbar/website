import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/newsletter/confirm.get'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is
// imported (the `export default defineEventHandler(...)` runs at load time).
// vitest hoists this vi.hoisted() block above all imports (including the
// handler import above), so these globals are set when that module evaluates.
const { readNewsletterSubscriberByToken, confirmNewsletterSubscriber } = vi.hoisted(() => {
    const readNewsletterSubscriberByToken = vi.fn()
    const confirmNewsletterSubscriber = vi.fn()
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.getQuery = (event: any) => event.query ?? {}
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = () => ({ readNewsletterSubscriberByToken, confirmNewsletterSubscriber })
    return { readNewsletterSubscriberByToken, confirmNewsletterSubscriber }
})

// Invoke the real handler with a mock H3 event (getQuery reads event.query).
const invoke = (query: Record<string, unknown>) => (handler as any)({ query })

// Fixed clock so expiry comparisons are deterministic.
const NOW = 1_700_000_000_000
const iso = (ms: number) => new Date(ms).toISOString()

beforeEach(() => {
    readNewsletterSubscriberByToken.mockReset()
    confirmNewsletterSubscriber.mockReset()
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('GET /api/newsletter/confirm', () => {
    it('returns invalid for a missing token, without touching Directus', async () => {
        const result = await invoke({})
        expect(result).toEqual({ status: 'invalid' })
        expect(readNewsletterSubscriberByToken).not.toHaveBeenCalled()
    })

    it('returns invalid for an empty token', async () => {
        const result = await invoke({ token: '' })
        expect(result).toEqual({ status: 'invalid' })
        expect(readNewsletterSubscriberByToken).not.toHaveBeenCalled()
    })

    it('returns invalid for an unknown token', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue(null)
        const result = await invoke({ token: 'nope' })
        expect(result).toEqual({ status: 'invalid' })
        expect(confirmNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('confirms a pending subscriber whose token is still valid', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'pending',
            confirm_token_expires_at: iso(NOW + 60_000),
        })
        const result = await invoke({ token: 'good' })
        expect(result).toEqual({ status: 'confirmed' })
        expect(confirmNewsletterSubscriber).toHaveBeenCalledTimes(1)
        expect(confirmNewsletterSubscriber).toHaveBeenCalledWith('sub_1')
    })

    it('is idempotent: an already-confirmed subscriber returns already_confirmed and is not re-written', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'confirmed',
            confirm_token_expires_at: iso(NOW + 60_000),
        })
        const result = await invoke({ token: 'good' })
        expect(result).toEqual({ status: 'already_confirmed' })
        expect(confirmNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('returns expired for a pending subscriber past the confirmation window', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'pending',
            confirm_token_expires_at: iso(NOW - 1),
        })
        const result = await invoke({ token: 'stale' })
        expect(result).toEqual({ status: 'expired' })
        expect(confirmNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('treats a non-pending, non-confirmed status (e.g. unsubscribed) as invalid', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'unsubscribed',
            confirm_token_expires_at: iso(NOW + 60_000),
        })
        const result = await invoke({ token: 'x' })
        expect(result).toEqual({ status: 'invalid' })
        expect(confirmNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('surfaces an unexpected Directus failure as 500', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        readNewsletterSubscriberByToken.mockRejectedValue(new Error('directus down'))
        await expect(invoke({ token: 'boom' })).rejects.toMatchObject({ statusCode: 500 })
    })
})
