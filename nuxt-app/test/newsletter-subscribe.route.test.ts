import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { isDuplicateError } from '../server/api/newsletter/subscribe.post'

// The handler's Nuxt/Nitro auto-imports must exist BEFORE the module is
// imported, because `export default defineEventHandler(...)` runs at load time.
// vitest hoists this vi.hoisted() block above all imports (including the
// handler import above), so these globals are set when that module evaluates.
const { createNewsletterSubscriber } = vi.hoisted(() => {
    const createNewsletterSubscriber = vi.fn()
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readBody = async (event: any) => event.body
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = () => ({ createNewsletterSubscriber })
    return { createNewsletterSubscriber }
})

// Invoke the real handler with a mock H3 event (readBody reads event.body).
const invoke = (body: unknown) => (handler as any)({ body })

const recordNotUnique = { errors: [{ extensions: { code: 'RECORD_NOT_UNIQUE' } }] }

beforeEach(() => {
    createNewsletterSubscriber.mockReset()
})

// Restore any spies (e.g. the console.error stub below) so they don't leak
// into later tests and swallow real output.
afterEach(() => {
    vi.restoreAllMocks()
})

describe('POST /api/newsletter/subscribe', () => {
    it('drops a filled honeypot silently, without touching Directus', async () => {
        const result = await invoke({ email: 'bot@example.com', honeypot: 'gotcha' })
        expect(result).toEqual({ status: 'success' })
        expect(createNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('rejects an invalid email with 400 and never writes', async () => {
        await expect(invoke({ email: 'not-an-email' })).rejects.toMatchObject({ statusCode: 400 })
        expect(createNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('rejects a missing body with 400', async () => {
        await expect(invoke(undefined)).rejects.toMatchObject({ statusCode: 400 })
        expect(createNewsletterSubscriber).not.toHaveBeenCalled()
    })

    it('writes ONLY a normalised (trimmed, lower-cased) email', async () => {
        createNewsletterSubscriber.mockResolvedValue({ id: 'sub_1' })
        const result = await invoke({ email: '  Person@Example.DE  ' })
        expect(result).toEqual({ status: 'success' })
        expect(createNewsletterSubscriber).toHaveBeenCalledTimes(1)
        expect(createNewsletterSubscriber).toHaveBeenCalledWith({ email: 'person@example.de' })
    })

    // Privacy regression guard: a duplicate must return the SAME success shape
    // as a new signup — not a distinguishable 'exists' and not a 500 — so the
    // endpoint can't be used for email enumeration.
    it('returns success (not "exists", not an error) for a duplicate address', async () => {
        createNewsletterSubscriber.mockRejectedValue(recordNotUnique)
        const result = await invoke({ email: 'duplicate@example.com' })
        expect(result).toEqual({ status: 'success' })
    })

    it('surfaces an unexpected Directus failure as 500', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        createNewsletterSubscriber.mockRejectedValue(new Error('directus down'))
        await expect(invoke({ email: 'person@example.com' })).rejects.toMatchObject({ statusCode: 500 })
    })
})

describe('isDuplicateError', () => {
    it('detects RECORD_NOT_UNIQUE at the top level and under response', () => {
        expect(isDuplicateError(recordNotUnique)).toBe(true)
        expect(isDuplicateError({ response: recordNotUnique })).toBe(true)
    })

    it('is false for other errors and empty inputs', () => {
        expect(isDuplicateError(new Error('nope'))).toBe(false)
        expect(isDuplicateError({ errors: [{ extensions: { code: 'FORBIDDEN' } }] })).toBe(false)
        expect(isDuplicateError({})).toBe(false)
        expect(isDuplicateError(null)).toBe(false)
        expect(isDuplicateError(undefined)).toBe(false)
    })
})
