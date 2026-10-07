import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendRawEmail } from './../../shared/email-service.ts'
import { postSlackMessage } from './../../shared/postSlackMessage.ts'
import { getRequiredSetting } from './../../shared/settings.ts'
import registerHook from './../index.ts'

// Tier 2 contract test (ADR 0003): the real hook against a fake Directus context.

jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

jest.mock('./../../shared/errors.ts', () => ({
    createHookErrorConstructor: (code: string, message: string, status?: number) =>
        class extends Error {
            code = code
            status = status
            constructor() {
                super(message)
            }
        },
}))

jest.mock('./../../shared/email-service.ts', () => ({
    ...(jest.requireActual('./../../shared/email-service.ts') as object),
    sendRawEmail: jest.fn(),
}))
jest.mock('./../../shared/settings.ts', () => ({
    getRequiredSetting: jest.fn(),
}))
jest.mock('./../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

const sendRawEmailMock = jest.mocked(sendRawEmail)
const getRequiredSettingMock = jest.mocked(getRequiredSetting)
const postSlackMessageMock = jest.mocked(postSlackMessage)

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

const MEETUP_ID = 'a3a8b2c4-0000-4000-8000-000000000001'
const IN_A_WEEK = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

interface World {
    meetup: Record<string, any> | null
    publicCount: number
    totalCount: number
    existing: Record<string, any> | null
    registration: Record<string, any>
}

function setup(world: Partial<World> = {}) {
    const state: World = {
        meetup: {
            id: MEETUP_ID,
            status: 'published',
            start_on: IN_A_WEEK,
            registration_enabled: true,
            registration_limit: 100,
        },
        publicCount: 0,
        totalCount: 0,
        existing: null,
        registration: {
            id: 'reg-1',
            status: 'confirmed',
            is_internal: false,
            full_name: 'Erika Mustermann',
            email: 'erika@example.com',
            cancel_token: 'token-1',
            wants_meetup_updates: false,
            date_created: '2026-10-07T10:00:00.000Z',
            meetup: {
                id: MEETUP_ID,
                slug: 'beispiel-meetup',
                title: 'Beispiel-Meetup',
                start_on: IN_A_WEEK,
                end_on: IN_A_WEEK,
                registration_limit: 100,
                speakers: [],
                talks: [],
            },
        },
        ...world,
    }

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const readByQuery = jest.fn(async (query: any) => {
        if (query.aggregate) {
            const isTotal = query.filter.is_internal === undefined
            return [{ count: { id: isTotal ? state.totalCount : state.publicCount } }]
        }
        if (query.filter.email) return state.existing ? [state.existing] : []
        return state.meetup ? [state.meetup] : []
    })
    const readOne = jest.fn(async () => state.registration)
    const ItemsService = jest.fn().mockImplementation(() => ({ readByQuery, readOne }))

    const filters = new Map<string, (...args: any[]) => any>()
    const actions = new Map<string, (...args: any[]) => any>()
    registerHook(
        {
            filter: (event: string, handler: any) => filters.set(event, handler),
            action: (event: string, handler: any) => actions.set(event, handler),
        } as any,
        { logger, services: { ItemsService, MailService: jest.fn() }, getSchema: async () => ({}), env: {} } as any
    )

    const raw = jest.fn(async () => undefined)
    const database = { client: { config: { client: 'pg' } }, raw }
    const create = (payload: Record<string, any>) =>
        filters.get('meetup_registrations.items.create')!(payload, {}, { database, schema: {} })
    const created = async (key = 'reg-1') => {
        actions.get('meetup_registrations.items.create')!({ key, payload: {} }, {})
        await flush()
        await flush()
    }

    return { state, create, created, raw, ItemsService }
}

beforeEach(() => {
    jest.clearAllMocks()
    sendRawEmailMock.mockResolvedValue(true)
    getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
})

describe('filter meetup_registrations.items.create', () => {
    test('normalizes the email, marks internal addresses and stamps consent', async () => {
        const { create, raw } = setup()

        const payload = await create({ meetup: MEETUP_ID, email: '  Erika@Lotum.DE ', wants_meetup_updates: true })

        expect(payload.email).toBe('erika@lotum.de')
        expect(payload.is_internal).toBe(true)
        expect(typeof payload.meetup_updates_consented_at).toBe('string')
        // The count runs under a per-meetup lock inside the insert transaction.
        expect(raw).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext(?))', [
            `meetup_registrations:${MEETUP_ID}`,
        ])
    })

    test('stores no consent timestamp without the checkbox', async () => {
        const payload = await setup().create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        expect(payload.is_internal).toBe(false)
        expect(payload.meetup_updates_consented_at).toBeNull()
    })

    test('rejects a full meetup for public addresses', async () => {
        const { create } = setup({ publicCount: 100 })
        await expect(create({ meetup: MEETUP_ID, email: 'erika@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_FULL',
            status: 409,
        })
    })

    test('still accepts internal addresses when the public limit is reached', async () => {
        const { create } = setup({ publicCount: 100 })
        await expect(create({ meetup: MEETUP_ID, email: 'max@lotum.de' })).resolves.toMatchObject({
            is_internal: true,
        })
    })

    test('rejects once the meetup has started', async () => {
        const { state, create } = setup()
        state.meetup!.start_on = YESTERDAY
        await expect(create({ meetup: MEETUP_ID, email: 'erika@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_CLOSED',
        })
    })

    test('rejects when registration is switched off or the meetup is missing', async () => {
        const off = setup()
        off.state.meetup!.registration_enabled = false
        await expect(off.create({ meetup: MEETUP_ID, email: 'a@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DISABLED',
        })

        const missing = setup({ meetup: null })
        await expect(missing.create({ meetup: MEETUP_ID, email: 'a@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DISABLED',
        })
    })

    test('a duplicate is rejected and its confirmation resent, even when full', async () => {
        const { create } = setup({ publicCount: 100, existing: { id: 'reg-1' } })

        await expect(create({ meetup: MEETUP_ID, email: 'Erika@Example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DUPLICATE',
        })
        await flush()
        await flush()

        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        expect(sendRawEmailMock.mock.calls[0]![0]).toMatchObject({ to: 'erika@example.com' })
    })
})

describe('action meetup_registrations.items.create', () => {
    test('sends the confirmation mail with HTML and text part', async () => {
        const { created } = setup()
        await created()

        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        const mail = sendRawEmailMock.mock.calls[0]![0]
        expect(mail.to).toBe('erika@example.com')
        expect(mail.subject).toContain('Beispiel-Meetup')
        expect(mail.html).toContain('https://www.programmier.bar/meetup/abmelden?token=token-1')
        expect(mail.text).toContain('https://www.programmier.bar/meetup/beispiel-meetup/kalender.ics')
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('does not mail a registration that is no longer confirmed', async () => {
        const { state, created } = setup()
        state.registration.status = 'cancelled'
        await created()
        expect(sendRawEmailMock).not.toHaveBeenCalled()
    })

    test('reports a failed mail to Slack', async () => {
        sendRawEmailMock.mockResolvedValue(false)
        const { created } = setup()
        await created()
        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('nicht gesendet'))
    })

    test('reports a missing website_url to Slack instead of sending a broken link', async () => {
        getRequiredSettingMock.mockRejectedValue(new Error('missing'))
        const { created } = setup()
        await created()
        expect(sendRawEmailMock).not.toHaveBeenCalled()
        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('website_url'))
    })

    test('reports the 80 % mark and the last spot to Slack', async () => {
        const at80 = setup({ publicCount: 80, totalCount: 92 })
        await at80.created()
        expect(postSlackMessageMock).toHaveBeenLastCalledWith(expect.stringContaining('80 von 100 Plätzen'))
        expect(postSlackMessageMock).toHaveBeenLastCalledWith(expect.stringContaining('92 Anmeldungen'))

        const full = setup({ publicCount: 100 })
        await full.created()
        expect(postSlackMessageMock).toHaveBeenLastCalledWith(expect.stringContaining('ausgebucht'))
    })
})
