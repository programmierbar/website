import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendTemplatedEmail } from './../../shared/email-service.ts'
import { postSlackMessage } from './../../shared/postSlackMessage.ts'
import { getRequiredSetting } from './../../shared/settings.ts'
import registerHook from './../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

// `@directus/errors` ships as ESM and is not transformed under Jest, so mock the
// wrapper that pulls it in (as the other hook tests do).
jest.mock('./../../shared/errors.ts', () => ({
    createHookErrorConstructor: (_hook: string, message: string) =>
        class extends Error {
            constructor() {
                super(message)
            }
        },
}))

// Mock the shared side-effect helpers so the hook never reaches the network.
jest.mock('./../../shared/email-service.ts', () => ({
    sendTemplatedEmail: jest.fn(),
}))
jest.mock('./../../shared/settings.ts', () => ({
    getRequiredSetting: jest.fn(),
}))
jest.mock('./../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

const sendTemplatedEmailMock = jest.mocked(sendTemplatedEmail)
const getRequiredSettingMock = jest.mocked(getRequiredSetting)
const postSlackMessageMock = jest.mocked(postSlackMessage)

// safeAction detaches the work into its own promise chain and returns void.
// Flushing the microtask queue lets that detached work settle before we assert.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type FilterHandler = (payload: any, meta?: any, ctx?: any) => any
type ActionHandler = (meta: any, ctx: any) => void

function setup(subscriber: Record<string, any> | null) {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const readOne = jest.fn(async () => subscriber)
    const ItemsService = jest.fn().mockImplementation(() => ({ readOne }))

    const filters = new Map<string, FilterHandler>()
    const actions = new Map<string, ActionHandler>()
    const register = {
        filter: (event: string, handler: FilterHandler) => filters.set(event, handler),
        action: (event: string, handler: ActionHandler) => actions.set(event, handler),
    }

    const hookContext = {
        logger,
        services: { ItemsService, MailService: jest.fn() },
        getSchema: async () => ({}),
    }

    registerHook(register as any, hookContext as any)

    return { filters, actions, readOne, logger }
}

const CREATE = 'newsletter_subscribers.items.create'
const UPDATE = 'newsletter_subscribers.items.update'

const invokeAction = async (handler: ActionHandler, meta: any) => {
    handler(meta, { accountability: {} })
    await flush()
}

describe('newsletter-double-opt-in hook', () => {
    beforeEach(() => {
        sendTemplatedEmailMock.mockReset()
        getRequiredSettingMock.mockReset()
        postSlackMessageMock.mockReset()
    })

    test('registers create + update filters and create + update actions', () => {
        const { filters, actions } = setup(null)
        expect(filters.has(CREATE)).toBe(true)
        expect(filters.has(UPDATE)).toBe(true)
        expect(actions.has(CREATE)).toBe(true)
        expect(actions.has(UPDATE)).toBe(true)
    })

    // Asserts the stamped window is ~24h out, without restating the TTL as a
    // second literal: the hook is the single source of truth for the value.
    const expectRoughly24hFrom = (isoDate: string, before: number, after: number) => {
        const TTL_MS = 24 * 60 * 60 * 1000
        const expiresAt = new Date(isoDate).getTime()
        expect(expiresAt).toBeGreaterThanOrEqual(before + TTL_MS)
        expect(expiresAt).toBeLessThanOrEqual(after + TTL_MS)
    }

    describe('create filter: confirm_token_expires_at', () => {
        test('sets it ~24h in the future when omitted', () => {
            const { filters } = setup(null)
            const before = Date.now()
            const result = filters.get(CREATE)!({ email: 'me@example.de' })
            const after = Date.now()

            expect(result.email).toBe('me@example.de')
            expectRoughly24hFrom(result.confirm_token_expires_at, before, after)
        })

        test('respects an explicitly supplied value', () => {
            const { filters } = setup(null)
            const explicit = '2030-01-01T00:00:00.000Z'
            const result = filters.get(CREATE)!({ email: 'me@example.de', confirm_token_expires_at: explicit })
            expect(result.confirm_token_expires_at).toBe(explicit)
        })
    })

    // The website's expired-link recovery rotates the token only; the TTL for the
    // new window is owned by the CMS, so create and refresh cannot drift apart.
    describe('update filter: confirm_token_expires_at', () => {
        test('stamps a fresh ~24h window when a new confirm_token is issued', () => {
            const { filters } = setup(null)
            const before = Date.now()
            const result = filters.get(UPDATE)!({ confirm_token: 'tok-new' })
            const after = Date.now()

            expect(result.confirm_token).toBe('tok-new')
            expectRoughly24hFrom(result.confirm_token_expires_at, before, after)
        })

        test('leaves updates that do not rotate the token untouched', () => {
            const { filters } = setup(null)
            const payload = { status: 'confirmed', confirmed_at: '2026-01-01T00:00:00.000Z' }
            const result = filters.get(UPDATE)!({ ...payload })

            expect(result).toEqual(payload)
            expect(result.confirm_token_expires_at).toBeUndefined()
        })

        test('respects an explicitly supplied window alongside a new token', () => {
            const { filters } = setup(null)
            const explicit = '2030-01-01T00:00:00.000Z'
            const result = filters.get(UPDATE)!({ confirm_token: 'tok-new', confirm_token_expires_at: explicit })
            expect(result.confirm_token_expires_at).toBe(explicit)
        })
    })

    describe('action: double-opt-in mail', () => {
        test('sends the ad-free template with a confirm link for a pending subscriber', async () => {
            getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
            sendTemplatedEmailMock.mockResolvedValue(true)
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'pending',
                confirm_token: 'tok-123',
            })

            await invokeAction(actions.get(CREATE)!, { key: 'sub_1' })

            expect(sendTemplatedEmailMock).toHaveBeenCalledTimes(1)
            const [options] = sendTemplatedEmailMock.mock.calls[0] as [any, any]
            expect(options.templateKey).toBe('newsletter_double_opt_in')
            expect(options.to).toBe('me@example.de')
            expect(options.data.confirm_url).toBe('https://www.programmier.bar/newsletter/confirm?token=tok-123')
            expect(postSlackMessageMock).not.toHaveBeenCalled()
        })

        test('does not send (and warns Slack) when website_url is not configured', async () => {
            getRequiredSettingMock.mockRejectedValue(new Error("Required setting 'website_url' is not configured"))
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'pending',
                confirm_token: 'tok-123',
            })

            await invokeAction(actions.get(CREATE)!, { key: 'sub_1' })

            // No guessed-host link is baked into a sent mail; a human is alerted.
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(postSlackMessageMock.mock.calls[0]?.[0]).toContain('website_url')
        })

        test('does not send for a non-pending subscriber', async () => {
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'confirmed',
                confirm_token: 'tok-123',
            })

            await invokeAction(actions.get(CREATE)!, { key: 'sub_1' })

            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
            expect(postSlackMessageMock).not.toHaveBeenCalled()
        })

        test('posts a Slack warning when the mail cannot be sent', async () => {
            getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
            sendTemplatedEmailMock.mockResolvedValue(false)
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'pending',
                confirm_token: 'tok-123',
            })

            await invokeAction(actions.get(CREATE)!, { key: 'sub_1' })

            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(postSlackMessageMock.mock.calls[0]?.[0]).toContain('me@example.de')
        })

        test('skips when the create action fires without a key', async () => {
            const { actions, readOne } = setup(null)

            await invokeAction(actions.get(CREATE)!, {})

            expect(readOne).not.toHaveBeenCalled()
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
        })
    })

    describe('action: resend on a new confirmation link', () => {
        test('resends when a pending row gets a rotated confirm_token', async () => {
            getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
            sendTemplatedEmailMock.mockResolvedValue(true)
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'pending',
                confirm_token: 'tok-new',
            })

            // What the website's refreshNewsletterConfirmation actually writes.
            await invokeAction(actions.get(UPDATE)!, {
                keys: ['sub_1'],
                payload: { confirm_token: 'tok-new' },
            })

            expect(sendTemplatedEmailMock).toHaveBeenCalledTimes(1)
            const [options] = sendTemplatedEmailMock.mock.calls[0] as [any, any]
            expect(options.data.confirm_url).toBe('https://www.programmier.bar/newsletter/confirm?token=tok-new')
        })

        test('resends when only the confirmation window is extended (e.g. a manual fix)', async () => {
            getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
            sendTemplatedEmailMock.mockResolvedValue(true)
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'pending',
                confirm_token: 'tok-123',
            })

            await invokeAction(actions.get(UPDATE)!, {
                keys: ['sub_1'],
                payload: { confirm_token_expires_at: '2030-01-01T00:00:00.000Z' },
            })

            expect(sendTemplatedEmailMock).toHaveBeenCalledTimes(1)
        })

        test('does not resend when the update touches neither token nor window', async () => {
            const { actions, readOne } = setup({ id: 'sub_1', email: 'me@example.de', status: 'confirmed' })

            // e.g. the confirm flip: sets status/confirmed_at, not the expiry.
            await invokeAction(actions.get(UPDATE)!, {
                keys: ['sub_1'],
                payload: { status: 'confirmed', confirmed_at: '2026-01-01T00:00:00.000Z' },
            })

            expect(readOne).not.toHaveBeenCalled()
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
        })
    })
})
