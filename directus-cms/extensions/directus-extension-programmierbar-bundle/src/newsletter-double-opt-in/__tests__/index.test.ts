import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendTemplatedEmail } from './../../shared/email-service.ts'
import { postSlackMessage } from './../../shared/postSlackMessage.ts'
import { getSetting } from './../../shared/settings.ts'
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
    getSetting: jest.fn(),
}))
jest.mock('./../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

const sendTemplatedEmailMock = jest.mocked(sendTemplatedEmail)
const getSettingMock = jest.mocked(getSetting)
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

const invokeAction = async (handler: ActionHandler, meta: any) => {
    handler(meta, { accountability: {} })
    await flush()
}

describe('newsletter-double-opt-in hook', () => {
    beforeEach(() => {
        sendTemplatedEmailMock.mockReset()
        getSettingMock.mockReset()
        postSlackMessageMock.mockReset()
    })

    test('registers a create filter and a create action', () => {
        const { filters, actions } = setup(null)
        expect(filters.has(CREATE)).toBe(true)
        expect(actions.has(CREATE)).toBe(true)
    })

    describe('filter: confirm_token_expires_at', () => {
        test('sets it ~24h in the future when omitted', () => {
            const { filters } = setup(null)
            const before = Date.now()
            const result = filters.get(CREATE)!({ email: 'me@example.de' })
            const after = Date.now()

            expect(result.email).toBe('me@example.de')
            const expiresAt = new Date(result.confirm_token_expires_at).getTime()
            expect(expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000)
            expect(expiresAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000)
        })

        test('respects an explicitly supplied value', () => {
            const { filters } = setup(null)
            const explicit = '2030-01-01T00:00:00.000Z'
            const result = filters.get(CREATE)!({ email: 'me@example.de', confirm_token_expires_at: explicit })
            expect(result.confirm_token_expires_at).toBe(explicit)
        })
    })

    describe('action: double-opt-in mail', () => {
        test('sends the ad-free template with a confirm link for a pending subscriber', async () => {
            getSettingMock.mockResolvedValue('https://www.programmier.bar')
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

        test('falls back to the default website URL when the setting is missing', async () => {
            getSettingMock.mockResolvedValue(null)
            sendTemplatedEmailMock.mockResolvedValue(true)
            const { actions } = setup({
                id: 'sub_1',
                email: 'me@example.de',
                status: 'pending',
                confirm_token: 'tok-123',
            })

            await invokeAction(actions.get(CREATE)!, { key: 'sub_1' })

            const [options] = sendTemplatedEmailMock.mock.calls[0] as [any, any]
            expect(options.data.confirm_url).toBe('https://www.programmier.bar/newsletter/confirm?token=tok-123')
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
            getSettingMock.mockResolvedValue('https://www.programmier.bar')
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
})
