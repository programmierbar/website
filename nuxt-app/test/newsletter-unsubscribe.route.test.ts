import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/newsletter/unsubscribe.post'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is
// imported (the `export default defineEventHandler(...)` runs at load time).
// vitest hoists this vi.hoisted() block above all imports (including the
// handler import above), so these globals are set when that module evaluates.
const { readNewsletterSubscriberByUnsubscribeToken, unsubscribeNewsletterSubscriber } = vi.hoisted(() => {
    const readNewsletterSubscriberByUnsubscribeToken = vi.fn()
    const unsubscribeNewsletterSubscriber = vi.fn()
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readBody = async (event: any) => event.body ?? {}
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = () => ({
        readNewsletterSubscriberByUnsubscribeToken,
        unsubscribeNewsletterSubscriber,
    })
    return { readNewsletterSubscriberByUnsubscribeToken, unsubscribeNewsletterSubscriber }
})

// Invoke the real handler with a mock H3 event (readBody reads event.body).
const invoke = (body: Record<string, unknown>) => (handler as any)({ body })

beforeEach(() => {
    readNewsletterSubscriberByUnsubscribeToken.mockReset()
    // The guarded write reports whether a row actually changed; default to "won
    // the race", so only the concurrency case below opts into `false`.
    unsubscribeNewsletterSubscriber.mockReset().mockResolvedValue(true)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /api/newsletter/unsubscribe', () => {
    it('returns invalid for a missing token, without touching Directus', async () => {
        const result = await invoke({})
        expect(result).toEqual({ status: 'invalid' })
        expect(readNewsletterSubscriberByUnsubscribeToken).not.toHaveBeenCalled()
    })

    it('returns invalid for an empty token', async () => {
        const result = await invoke({ token: '' })
        expect(result).toEqual({ status: 'invalid' })
        expect(readNewsletterSubscriberByUnsubscribeToken).not.toHaveBeenCalled()
    })

    it('returns invalid for an unknown token', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue(null)
        const result = await invoke({ token: 'nope' })
        expect(result).toEqual({ status: 'invalid' })
        expect(unsubscribeNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('unsubscribes a confirmed subscriber', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue({ id: 'sub_1', status: 'confirmed' })
        const result = await invoke({ token: 'good' })
        expect(result).toEqual({ status: 'unsubscribed' })
        expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledTimes(1)
        // The token is passed along so the write can be guarded on it.
        expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledWith('sub_1', 'good')
    })

    it('unsubscribes a pending subscriber that never confirmed', async () => {
        // Opting out has to work before confirmation too — it also stops the
        // confirmation resends.
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue({ id: 'sub_1', status: 'pending' })
        const result = await invoke({ token: 'good' })
        expect(result).toEqual({ status: 'unsubscribed' })
        expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledTimes(1)
    })

    it('is idempotent: an already-unsubscribed subscriber is not re-written', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue({
            id: 'sub_1',
            status: 'unsubscribed',
            unsubscribed_at: '2026-01-01T00:00:00.000Z',
        })
        const result = await invoke({ token: 'good' })
        expect(result).toEqual({ status: 'already_unsubscribed' })
        // Keeps the original opt-out timestamp instead of pushing it forward.
        expect(unsubscribeNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('reports already_unsubscribed when a concurrent request got there first', async () => {
        readNewsletterSubscriberByUnsubscribeToken
            .mockResolvedValueOnce({ id: 'sub_1', status: 'confirmed' })
            .mockResolvedValueOnce({ id: 'sub_1', status: 'unsubscribed' })
        unsubscribeNewsletterSubscriber.mockResolvedValue(false)

        const result = await invoke({ token: 'good' })
        expect(result).toEqual({ status: 'already_unsubscribed' })
    })

    it('surfaces an unexpected Directus failure as 500', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        readNewsletterSubscriberByUnsubscribeToken.mockRejectedValue(new Error('directus down'))
        await expect(invoke({ token: 'boom' })).rejects.toMatchObject({ statusCode: 500 })
    })
})
