import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import availabilityHandler from '../server/api/meetup-registration/availability.get'
import cancelHandler from '../server/api/meetup-registration/cancel.post'
import registerHandler from '../server/api/meetup-registration/register.post'
import cancelFormHandler from '../server/routes/meetup/abmelden.post'
import {
    FORM_TOKEN_MIN_AGE_MS,
    issueFormToken,
    resetRateLimits,
    takeRateLimit,
    verifyFormToken,
} from '../server/utils/formProtection'

// Nuxt/Nitro auto-imports must exist before the handlers are imported (their
// `defineEventHandler(...)` runs at load time); vi.hoisted runs first.
const directus = vi.hoisted(() => {
    const directus = {
        getMeetupRegistrationSettings: vi.fn(),
        countPublicMeetupRegistrations: vi.fn(),
        createMeetupRegistration: vi.fn(),
        readMeetupRegistrationByCancelToken: vi.fn(),
        cancelMeetupRegistration: vi.fn(),
    }
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.readBody = async (event: any) => event.body ?? {}
    g.getQuery = (event: any) => event.query ?? {}
    g.getRequestIP = (event: any) => event.ip ?? '203.0.113.1'
    g.sendRedirect = async (_event: any, location: string, status?: number) => ({ location, status })
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useRuntimeConfig = () => ({
        directusApiToken: 'test-token',
        turnstileSecretKey: '',
        public: { turnstileSiteKey: '' },
    })
    g.useAuthenticatedDirectus = () => directus
    return directus
})

const MEETUP_ID = 'a3a8b2c4-0000-4000-8000-000000000001'
const CANCEL_TOKEN = '3f2c9a1e-7b4d-4e0a-9c61-2d8f5b0e6a17'
const scope = `meetup-registration:${MEETUP_ID}`

// A token issued long enough ago to pass the minimum fill time.
const validToken = () => issueFormToken(scope, Date.now() - FORM_TOKEN_MIN_AGE_MS - 1000)

const form = (overrides: Record<string, unknown> = {}) => ({
    meetupId: MEETUP_ID,
    full_name: 'Erika Mustermann',
    email: 'erika@example.com',
    formToken: validToken(),
    ...overrides,
})

const register = (body: unknown, ip?: string) => (registerHandler as any)({ body, ip })
const directusError = (code: string) => ({ errors: [{ extensions: { code } }] })

beforeEach(() => {
    Object.values(directus).forEach((fn) => fn.mockReset())
    directus.createMeetupRegistration.mockResolvedValue({ id: 'reg-1' })
    resetRateLimits()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('form token', () => {
    it('accepts a token for its scope after the minimum fill time', () => {
        expect(verifyFormToken(validToken(), scope)).toBe('ok')
    })

    it('rejects missing, tampered, foreign, fresh and stale tokens', () => {
        const now = Date.now()
        expect(verifyFormToken(undefined, scope)).toBe('missing')
        expect(verifyFormToken(`${validToken()}x`, scope)).toBe('invalid')
        expect(verifyFormToken(validToken(), 'meetup-registration:other')).toBe('invalid')
        expect(verifyFormToken(issueFormToken(scope, now), scope, now + 500)).toBe('too_fast')
        expect(verifyFormToken(issueFormToken(scope, now), scope, now + 13 * 60 * 60 * 1000)).toBe('expired')
    })

    it('rate-limits per key within a window', () => {
        expect(takeRateLimit('k', 2, 1000, 0)).toBe(true)
        expect(takeRateLimit('k', 2, 1000, 1)).toBe(true)
        expect(takeRateLimit('k', 2, 1000, 2)).toBe(false)
        expect(takeRateLimit('k', 2, 1000, 1001)).toBe(true)
    })
})

describe('POST /api/meetup-registration/register', () => {
    it('drops a filled honeypot with the normal success answer', async () => {
        await expect(register(form({ honeypot: 'http://spam.example' }))).resolves.toEqual({ status: 'registered' })
        expect(directus.createMeetupRegistration).not.toHaveBeenCalled()
    })

    it('rejects a request without form token, e.g. a script posting directly', async () => {
        await expect(register(form({ formToken: undefined }))).rejects.toMatchObject({ statusCode: 400 })
        expect(directus.createMeetupRegistration).not.toHaveBeenCalled()
    })

    it('rejects a submit faster than a human could fill the form', async () => {
        await expect(register(form({ formToken: issueFormToken(scope) }))).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('schnell'),
        })
    })

    it('rejects invalid input with 400', async () => {
        await expect(register(form({ email: 'nope' }))).rejects.toMatchObject({ statusCode: 400 })
    })

    it('creates the registration with normalized optional fields', async () => {
        await expect(
            register(form({ pronouns: '', heard_about_from: 'podcast', has_meetup_account: false }))
        ).resolves.toEqual({ status: 'registered' })
        expect(directus.createMeetupRegistration).toHaveBeenCalledWith({
            meetup: MEETUP_ID,
            full_name: 'Erika Mustermann',
            email: 'erika@example.com',
            pronouns: null,
            role: null,
            company: null,
            heard_about_from: 'podcast',
            heard_about_other: null,
            has_meetup_account: false,
            wants_meetup_updates: false,
        })
    })

    it('answers a duplicate exactly like a new registration (no enumeration)', async () => {
        directus.createMeetupRegistration.mockRejectedValue(directusError('MEETUP_REGISTRATION_DUPLICATE'))
        await expect(register(form())).resolves.toEqual({ status: 'registered' })
    })

    it('maps full and closed to 409 with the state', async () => {
        directus.createMeetupRegistration.mockRejectedValue(directusError('MEETUP_REGISTRATION_FULL'))
        await expect(register(form())).rejects.toMatchObject({ statusCode: 409, data: { state: 'full' } })

        directus.createMeetupRegistration.mockRejectedValue(directusError('MEETUP_REGISTRATION_CLOSED'))
        await expect(register(form())).rejects.toMatchObject({ statusCode: 409, data: { state: 'closed' } })
    })

    it('surfaces unexpected failures as 500', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        directus.createMeetupRegistration.mockRejectedValue(new Error('directus down'))
        await expect(register(form())).rejects.toMatchObject({ statusCode: 500 })
    })

    it('rate-limits one source', async () => {
        for (let i = 0; i < 20; i++) {
            await register(form(), '198.51.100.7')
        }
        await expect(register(form(), '198.51.100.7')).rejects.toMatchObject({ statusCode: 429 })
        await expect(register(form(), '198.51.100.8')).resolves.toEqual({ status: 'registered' })
    })
})

describe('GET /api/meetup-registration/availability', () => {
    const availability = (meetup: unknown) => (availabilityHandler as any)({ query: { meetup } })

    it('returns state, spots left and a form token', async () => {
        directus.getMeetupRegistrationSettings.mockResolvedValue({
            status: 'published',
            start_on: new Date(Date.now() + 86_400_000).toISOString(),
            registration_enabled: true,
            registration_limit: 100,
        })
        directus.countPublicMeetupRegistrations.mockResolvedValue(40)

        const result = await availability(MEETUP_ID)
        expect(result).toMatchObject({ state: 'open', spotsLeft: 60, turnstileSiteKey: null })
        expect(verifyFormToken(result.formToken, scope, Date.now() + FORM_TOKEN_MIN_AGE_MS)).toBe('ok')
    })

    it('hands out no token once registration is closed', async () => {
        directus.getMeetupRegistrationSettings.mockResolvedValue({
            status: 'published',
            start_on: new Date(Date.now() - 1000).toISOString(),
            registration_enabled: true,
            registration_limit: null,
        })
        directus.countPublicMeetupRegistrations.mockResolvedValue(0)
        await expect(availability(MEETUP_ID)).resolves.toMatchObject({ state: 'closed', formToken: null })
    })

    it('rejects a malformed id before it reaches Directus', async () => {
        await expect(availability('1 OR 1=1')).rejects.toMatchObject({ statusCode: 400 })
        expect(directus.getMeetupRegistrationSettings).not.toHaveBeenCalled()
    })
})

describe('cancel', () => {
    const cancel = (body: unknown) => (cancelHandler as any)({ body })
    const cancelForm = (body: unknown) => (cancelFormHandler as any)({ body })

    beforeEach(() => {
        directus.cancelMeetupRegistration.mockResolvedValue(true)
    })

    it('cancels a confirmed registration', async () => {
        directus.readMeetupRegistrationByCancelToken.mockResolvedValue({ id: 'reg-1', status: 'confirmed' })
        await expect(cancel({ token: CANCEL_TOKEN })).resolves.toEqual({ status: 'cancelled' })
        expect(directus.cancelMeetupRegistration).toHaveBeenCalledWith('reg-1', CANCEL_TOKEN)
    })

    it('is idempotent', async () => {
        directus.readMeetupRegistrationByCancelToken.mockResolvedValue({ id: 'reg-1', status: 'cancelled' })
        await expect(cancel({ token: CANCEL_TOKEN })).resolves.toEqual({ status: 'already_cancelled' })
        expect(directus.cancelMeetupRegistration).not.toHaveBeenCalled()
    })

    it('answers unknown and malformed tokens neutrally', async () => {
        directus.readMeetupRegistrationByCancelToken.mockResolvedValue(null)
        await expect(cancel({ token: CANCEL_TOKEN })).resolves.toEqual({ status: 'invalid' })
        await expect(cancel({ token: 'not-a-uuid' })).resolves.toEqual({ status: 'invalid' })
        expect(directus.readMeetupRegistrationByCancelToken).toHaveBeenCalledTimes(1)
    })

    it('reports a lost race from the current state', async () => {
        directus.readMeetupRegistrationByCancelToken
            .mockResolvedValueOnce({ id: 'reg-1', status: 'confirmed' })
            .mockResolvedValueOnce({ id: 'reg-1', status: 'cancelled' })
        directus.cancelMeetupRegistration.mockResolvedValue(false)
        await expect(cancel({ token: CANCEL_TOKEN })).resolves.toEqual({ status: 'already_cancelled' })
    })

    it('no-JS form redirects with the outcome, also on failure', async () => {
        directus.readMeetupRegistrationByCancelToken.mockResolvedValue({ id: 'reg-1', status: 'confirmed' })
        await expect(cancelForm({ token: CANCEL_TOKEN })).resolves.toEqual({
            location: '/meetup/abmelden?status=cancelled',
            status: 303,
        })

        vi.spyOn(console, 'error').mockImplementation(() => {})
        directus.readMeetupRegistrationByCancelToken.mockRejectedValue(new Error('down'))
        await expect(cancelForm({ token: CANCEL_TOKEN })).resolves.toEqual({
            location: '/meetup/abmelden?status=error',
            status: 303,
        })
    })
})
