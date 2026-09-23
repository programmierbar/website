import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNewsletterSignup } from '../composables/useNewsletterSignup'

// The composable calls the Nuxt-global `$fetch`; stub it so no real request
// goes out and we can drive each outcome.
const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => {
    fetchMock.mockReset()
})

describe('useNewsletterSignup', () => {
    it('starts idle with no message', () => {
        const signup = useNewsletterSignup()
        expect(signup.status).toBe('idle')
        expect(signup.message).toBe('')
    })

    it('rejects an invalid address client-side without calling the API', async () => {
        const signup = useNewsletterSignup()
        await signup.subscribe('not-an-email')
        expect(signup.status).toBe('error')
        expect(signup.message).toContain('gültige')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts the trimmed email + honeypot and resolves to success', async () => {
        fetchMock.mockResolvedValue({ status: 'success' })
        const signup = useNewsletterSignup()
        await signup.subscribe('  person@example.com  ', 'trap')
        expect(fetchMock).toHaveBeenCalledWith('/api/newsletter/subscribe', {
            method: 'POST',
            body: { email: 'person@example.com', honeypot: 'trap' },
        })
        expect(signup.status).toBe('success')
    })

    it('is in the loading state while the request is in flight', async () => {
        let resolveFetch!: (value: unknown) => void
        fetchMock.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
        const signup = useNewsletterSignup()
        const pending = signup.subscribe('person@example.com')
        expect(signup.status).toBe('loading')
        resolveFetch({ status: 'success' })
        await pending
        expect(signup.status).toBe('success')
    })

    it('maps a server failure to the error state', async () => {
        fetchMock.mockRejectedValue(new Error('boom'))
        const signup = useNewsletterSignup()
        await signup.subscribe('person@example.com')
        expect(signup.status).toBe('error')
        expect(signup.message).toContain('nicht geklappt')
    })

    // Privacy regression guard: a repeat signup must look exactly like a new
    // one. There is no 'exists'/'already subscribed' state to surface, so the
    // form cannot be used to probe who is on the list.
    it('never exposes an "already subscribed" state', async () => {
        fetchMock.mockResolvedValue({ status: 'success' })
        const signup = useNewsletterSignup()
        await signup.subscribe('duplicate@example.com')
        expect(signup.status).toBe('success')
        expect(signup.status).not.toBe('exists')
    })

    it('reset() returns to idle and clears the message', async () => {
        const signup = useNewsletterSignup()
        await signup.subscribe('bad')
        expect(signup.status).toBe('error')
        signup.reset()
        expect(signup.status).toBe('idle')
        expect(signup.message).toBe('')
    })

    it('isValidEmail accepts valid addresses (trimmed) and rejects the rest', () => {
        const signup = useNewsletterSignup()
        expect(signup.isValidEmail('a@b.de')).toBe(true)
        expect(signup.isValidEmail('  a@b.de  ')).toBe(true)
        expect(signup.isValidEmail('nope')).toBe(false)
        expect(signup.isValidEmail('')).toBe(false)
    })
})
