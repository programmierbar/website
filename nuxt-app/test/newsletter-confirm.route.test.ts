import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/api/newsletter/confirm.post'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is
// imported (the `export default defineEventHandler(...)` runs at load time).
// vitest hoists this vi.hoisted() block above all imports (including the
// handler import above), so these globals are set when that module evaluates.
const { readNewsletterSubscriberByToken, confirmNewsletterSubscriber, refreshNewsletterConfirmation } = vi.hoisted(
    () => {
        const readNewsletterSubscriberByToken = vi.fn()
        const confirmNewsletterSubscriber = vi.fn()
        const refreshNewsletterConfirmation = vi.fn()
        const g = globalThis as any
        g.defineEventHandler = (fn: any) => fn
        g.readBody = async (event: any) => event.body ?? {}
        g.createError = (input: any) => Object.assign(new Error(input.message), input)
        g.useAuthenticatedDirectus = () => ({
            readNewsletterSubscriberByToken,
            confirmNewsletterSubscriber,
            refreshNewsletterConfirmation,
        })
        return { readNewsletterSubscriberByToken, confirmNewsletterSubscriber, refreshNewsletterConfirmation }
    }
)

// Invoke the real handler with a mock H3 event (readBody reads event.body).
const invoke = (body: Record<string, unknown>) => (handler as any)({ body })

// Fixed clock so expiry comparisons are deterministic.
const NOW = 1_700_000_000_000
const iso = (ms: number) => new Date(ms).toISOString()

beforeEach(() => {
    readNewsletterSubscriberByToken.mockReset()
    confirmNewsletterSubscriber.mockReset()
    refreshNewsletterConfirmation.mockReset()
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /api/newsletter/confirm', () => {
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

    it('refreshes and resends (not confirms) for a pending subscriber past the window', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'pending',
            confirm_token_expires_at: iso(NOW - 1),
        })
        const result = await invoke({ token: 'stale' })
        expect(result).toEqual({ status: 'resent' })
        expect(refreshNewsletterConfirmation).toHaveBeenCalledTimes(1)
        expect(refreshNewsletterConfirmation).toHaveBeenCalledWith('sub_1')
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
