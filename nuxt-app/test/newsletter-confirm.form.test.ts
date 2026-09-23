import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/routes/newsletter/confirm.post'

// The no-JS confirmation path: a plain form POST, answered with a redirect that
// carries the outcome so the page can render it server-side.
//
// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported
// (the `export default defineEventHandler(...)` runs at load time). vitest hoists
// this vi.hoisted() block above all imports, so these globals are set when that
// module evaluates.
const { readNewsletterSubscriberByToken, confirmNewsletterSubscriber, refreshNewsletterConfirmation, sendRedirect } =
    vi.hoisted(() => {
        const readNewsletterSubscriberByToken = vi.fn()
        const confirmNewsletterSubscriber = vi.fn()
        const refreshNewsletterConfirmation = vi.fn()
        // Record what the handler redirects to instead of touching a response.
        const sendRedirect = vi.fn(async (_event: any, location: string, status?: number) => ({ location, status }))
        const g = globalThis as any
        g.defineEventHandler = (fn: any) => fn
        g.readBody = async (event: any) => event.body ?? {}
        g.sendRedirect = sendRedirect
        g.useAuthenticatedDirectus = () => ({
            readNewsletterSubscriberByToken,
            confirmNewsletterSubscriber,
            refreshNewsletterConfirmation,
        })
        return {
            readNewsletterSubscriberByToken,
            confirmNewsletterSubscriber,
            refreshNewsletterConfirmation,
            sendRedirect,
        }
    })

const invoke = (body: Record<string, unknown>) => (handler as any)({ body })

const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

beforeEach(() => {
    readNewsletterSubscriberByToken.mockReset()
    // The guarded writes report whether a row actually changed; default to "won
    // the race" so only the concurrency cases opt into `false`.
    confirmNewsletterSubscriber.mockReset().mockResolvedValue(true)
    refreshNewsletterConfirmation.mockReset().mockResolvedValue(true)
    sendRedirect.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

const expectRedirect = (status: string) =>
    expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), `/newsletter/confirm?status=${status}`, 303)

describe('POST /newsletter/confirm (no-JS form)', () => {
    // 303 specifically: the browser must follow up with a GET, so a reload cannot
    // repeat the submission — which on an expired link would rotate the token a
    // second time and send another mail.
    it('confirms a pending subscriber and redirects with the outcome', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'pending',
            confirm_token_expires_at: inOneHour,
        })

        await invoke({ token: 'good' })

        expect(confirmNewsletterSubscriber).toHaveBeenCalledWith('sub_1', 'good')
        expectRedirect('confirmed')
    })

    it('reports an already-confirmed address without re-writing it', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({ id: 'sub_1', status: 'confirmed' })

        await invoke({ token: 'good' })

        expect(confirmNewsletterSubscriber).not.toHaveBeenCalled()
        expectRedirect('already_confirmed')
    })

    it('refreshes an expired link and reports the resend', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue({
            id: 'sub_1',
            status: 'pending',
            confirm_token_expires_at: anHourAgo,
        })

        await invoke({ token: 'stale' })

        expect(refreshNewsletterConfirmation).toHaveBeenCalledWith('sub_1', 'stale')
        expect(confirmNewsletterSubscriber).not.toHaveBeenCalled()
        expectRedirect('resent')
    })

    it('reports an unknown token as invalid', async () => {
        readNewsletterSubscriberByToken.mockResolvedValue(null)

        await invoke({ token: 'nope' })

        expectRedirect('invalid')
    })

    it('reports a missing token as invalid, without touching Directus', async () => {
        await invoke({})

        expect(readNewsletterSubscriberByToken).not.toHaveBeenCalled()
        expectRedirect('invalid')
    })

    // A technical failure must not leave the visitor on a dead page: the 'error'
    // view renders another submit button, which works without JS too.
    it('redirects to the error state when Directus fails, rather than throwing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        readNewsletterSubscriberByToken.mockRejectedValue(new Error('directus down'))

        await invoke({ token: 'boom' })

        expectRedirect('error')
    })
})
