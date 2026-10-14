import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../server/routes/newsletter/unsubscribe.post'

// The no-JS opt-out path: a plain form POST, answered with a redirect that
// carries the outcome so the page can render it server-side.
//
// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is imported
// (the `export default defineEventHandler(...)` runs at load time). vitest hoists
// this vi.hoisted() block above all imports, so these globals are set when that
// module evaluates.
const { readNewsletterSubscriberByUnsubscribeToken, unsubscribeNewsletterSubscriber, sendRedirect } = vi.hoisted(() => {
    const readNewsletterSubscriberByUnsubscribeToken = vi.fn()
    const unsubscribeNewsletterSubscriber = vi.fn()
    // Record what the handler redirects to instead of touching a response.
    const sendRedirect = vi.fn(async (_event: any, location: string, status?: number) => ({ location, status }))
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readBody = async (event: any) => event.body ?? {}
    g.getQuery = (event: any) => event.query ?? {}
    g.createError = (input: { statusCode: number; message: string }) =>
        Object.assign(new Error(input.message), { statusCode: input.statusCode })
    g.sendRedirect = sendRedirect
    g.useAuthenticatedDirectus = () => ({
        readNewsletterSubscriberByUnsubscribeToken,
        unsubscribeNewsletterSubscriber,
    })
    return { readNewsletterSubscriberByUnsubscribeToken, unsubscribeNewsletterSubscriber, sendRedirect }
})

const invoke = (body: Record<string, unknown>, query: Record<string, unknown> = {}) => (handler as any)({ body, query })

beforeEach(() => {
    readNewsletterSubscriberByUnsubscribeToken.mockReset()
    unsubscribeNewsletterSubscriber.mockReset().mockResolvedValue(true)
    sendRedirect.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /newsletter/unsubscribe (no-JS form)', () => {
    // 303 specifically: the browser must follow up with a GET, so a reload of
    // the result page cannot repeat the submission.
    it('opts the subscriber out and redirects with the outcome', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue({ id: 'sub_1', status: 'confirmed' })

        await invoke({ token: 'good' })

        expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledWith('sub_1', 'good')
        expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), '/newsletter/unsubscribe?status=unsubscribed', 303)
    })

    it('reports an already-unsubscribed address without re-writing it', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue({ id: 'sub_1', status: 'unsubscribed' })

        await invoke({ token: 'good' })

        expect(unsubscribeNewsletterSubscriber).not.toHaveBeenCalled()
        expect(sendRedirect).toHaveBeenCalledWith(
            expect.anything(),
            '/newsletter/unsubscribe?status=already_unsubscribed',
            303
        )
    })

    it('reports an unknown token as invalid', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue(null)

        await invoke({ token: 'nope' })

        expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), '/newsletter/unsubscribe?status=invalid', 303)
    })

    it('reports a missing token as invalid, without touching Directus', async () => {
        await invoke({})

        expect(readNewsletterSubscriberByUnsubscribeToken).not.toHaveBeenCalled()
        expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), '/newsletter/unsubscribe?status=invalid', 303)
    })

    // A technical failure must not leave the visitor on a dead page: the 'error'
    // view renders another submit button, which works without JS too.
    it('redirects to the error state when Directus fails, rather than throwing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        readNewsletterSubscriberByUnsubscribeToken.mockRejectedValue(new Error('directus down'))

        await invoke({ token: 'boom' })

        expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), '/newsletter/unsubscribe?status=error', 303)
    })

    // A query token is only a fallback: the page's form always sends it in the body.
    it('prefers the body token over the query', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue(null)

        await invoke({ token: 'from-body' }, { token: 'from-query' })

        expect(readNewsletterSubscriberByUnsubscribeToken).toHaveBeenCalledWith('from-body')
    })
})

// RFC 8058: the mail provider POSTs `List-Unsubscribe=One-Click` to the link from the
// `List-Unsubscribe` header; the token is only in that link's query.
describe('POST /newsletter/unsubscribe (one-click)', () => {
    const ONE_CLICK = { 'List-Unsubscribe': 'One-Click' }

    it('opts the subscriber out using the query token and answers 200 without a redirect', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue({ id: 'sub_1', status: 'confirmed' })

        const result = await invoke(ONE_CLICK, { token: 'good' })

        expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledWith('sub_1', 'good')
        expect(result).toEqual({ status: 'unsubscribed' })
        expect(sendRedirect).not.toHaveBeenCalled()
    })

    it('answers an unknown token neutrally', async () => {
        readNewsletterSubscriberByUnsubscribeToken.mockResolvedValue(null)

        expect(await invoke(ONE_CLICK, { token: 'nope' })).toEqual({ status: 'invalid' })
        expect(unsubscribeNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('fails with 500 on a technical error so the provider can retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        readNewsletterSubscriberByUnsubscribeToken.mockRejectedValue(new Error('directus down'))

        await expect(invoke(ONE_CLICK, { token: 'boom' })).rejects.toMatchObject({ statusCode: 500 })
        expect(sendRedirect).not.toHaveBeenCalled()
    })
})
