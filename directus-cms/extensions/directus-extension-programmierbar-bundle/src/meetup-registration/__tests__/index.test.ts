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
    rows: Record<string, any>[]
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
        rows: [],
        registration: {
            id: 'reg-1',
            status: 'confirmed',
            is_internal: false,
            first_name: 'Erika',
            last_name: 'Mustermann',
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
    const updateOne = jest.fn(async (key: string, data: Record<string, any>) => {
        Object.assign(state.registration, data)
        return key
    })
    const readMany = jest.fn(async () => state.rows)
    const ItemsService = jest.fn().mockImplementation(() => ({ readByQuery, readOne, readMany, updateOne }))

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
    const update = (keys: string[], payload: Record<string, any>) =>
        filters.get('meetup_registrations.items.update')!(payload, { keys }, { database, schema: {} })
    const created = async (key = 'reg-1') => {
        actions.get('meetup_registrations.items.create')!({ key, payload: {} }, {})
        await flush()
        await flush()
    }

    return { state, create, created, update, raw, ItemsService, readByQuery, readMany, updateOne }
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

    test('locks on the canonical meetup id, whatever its spelling', async () => {
        const { create, raw } = setup()
        await create({ meetup: MEETUP_ID.toUpperCase(), email: 'erika@example.com' })
        await create({ meetup: { id: MEETUP_ID.toUpperCase() }, email: 'max@example.com' })
        expect(raw.mock.calls.map((call: any[]) => call[1])).toEqual([
            [`meetup_registrations:${MEETUP_ID}`],
            [`meetup_registrations:${MEETUP_ID}`],
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

    test('a duplicate is rejected and its confirmation resent', async () => {
        const { create } = setup({ existing: { id: 'reg-1' } })

        await expect(create({ meetup: MEETUP_ID, email: 'Erika@Example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DUPLICATE',
        })
        await flush()
        await flush()

        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        expect(sendRawEmailMock.mock.calls[0]![0]).toMatchObject({ to: 'erika@example.com' })
    })

    test('when full, a registered public address gets the same answer as a new one, the mail privately', async () => {
        const { create } = setup({ publicCount: 100, existing: { id: 'reg-1' } })

        await expect(create({ meetup: MEETUP_ID, email: 'Erika@Example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_FULL',
        })
        await flush()
        await flush()

        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        expect(sendRawEmailMock.mock.calls[0]![0]).toMatchObject({ to: 'erika@example.com' })

        // Internal addresses are not limited, so for them it stays a duplicate.
        const internal = setup({ publicCount: 100, existing: { id: 'reg-2' } })
        await expect(internal.create({ meetup: MEETUP_ID, email: 'max@lotum.de' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DUPLICATE',
        })
    })

    test('a duplicate that opts in records the consent on the existing row before resending', async () => {
        const { create, updateOne } = setup({ existing: { id: 'reg-1', wants_meetup_updates: false } })

        await expect(
            create({ meetup: MEETUP_ID, email: 'erika@example.com', wants_meetup_updates: true })
        ).rejects.toMatchObject({ code: 'MEETUP_REGISTRATION_DUPLICATE' })
        await flush()
        await flush()

        expect(updateOne).toHaveBeenCalledTimes(1)
        expect(updateOne).toHaveBeenCalledWith('reg-1', {
            wants_meetup_updates: true,
            meetup_updates_consented_at: expect.any(String),
        })
        // The resent confirmation already reflects the opt-in.
        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        expect(sendRawEmailMock.mock.calls[0]![0].text).toContain('kommende Meetups')
    })

    test('a duplicate never changes an existing opt-in', async () => {
        const optedIn = setup({ existing: { id: 'reg-1', wants_meetup_updates: true } })
        await expect(
            optedIn.create({ meetup: MEETUP_ID, email: 'erika@example.com', wants_meetup_updates: true })
        ).rejects.toMatchObject({ code: 'MEETUP_REGISTRATION_DUPLICATE' })

        const withoutCheckbox = setup({ existing: { id: 'reg-1', wants_meetup_updates: true } })
        await expect(withoutCheckbox.create({ meetup: MEETUP_ID, email: 'erika@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DUPLICATE',
        })
        await flush()
        await flush()

        expect(optedIn.updateOne).not.toHaveBeenCalled()
        expect(withoutCheckbox.updateOne).not.toHaveBeenCalled()
        expect(sendRawEmailMock).toHaveBeenCalledTimes(2)
    })

    test('a failed consent update goes to Slack and the confirmation is still resent', async () => {
        const { create, updateOne } = setup({ existing: { id: 'reg-1', wants_meetup_updates: false } })
        updateOne.mockRejectedValueOnce(new Error('db down'))

        await expect(
            create({ meetup: MEETUP_ID, email: 'erika@example.com', wants_meetup_updates: true })
        ).rejects.toMatchObject({ code: 'MEETUP_REGISTRATION_DUPLICATE' })
        await flush()
        await flush()

        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('nicht gespeichert'))
        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        expect(sendRawEmailMock.mock.calls[0]![0].text).not.toContain('kommende Meetups')
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
        const at80 = setup({ publicCount: 79, totalCount: 92 })
        await at80.create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        await at80.created()
        expect(postSlackMessageMock).toHaveBeenLastCalledWith(expect.stringContaining('80 von 100 Plätzen'))
        expect(postSlackMessageMock).toHaveBeenLastCalledWith(expect.stringContaining('92 Anmeldungen'))

        const full = setup({ publicCount: 99 })
        await full.create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        await full.created()
        expect(postSlackMessageMock).toHaveBeenLastCalledWith(expect.stringContaining('ausgebucht'))
        expect(postSlackMessageMock).toHaveBeenCalledTimes(2)
    })

    test('reports each milestone once, even for registrations with the same date_created', async () => {
        const { state, create, created } = setup({ publicCount: 79 })
        // Both are counted under the lock before either action runs.
        await create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        state.publicCount = 80
        await create({ meetup: MEETUP_ID, email: 'max@example.com' })

        await created('reg-1')
        state.registration = { ...state.registration, id: 'reg-2', email: 'max@example.com' }
        await created('reg-2')

        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('80 von 100 Plätzen'))
    })

    test('a retry after a failed insert does not re-announce the milestone', async () => {
        const { state, create, created } = setup({ publicCount: 79 })
        // Reached 80 %, but the insert then failed: no action ran.
        await create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        // Meanwhile someone else took the 80th spot (and its own notice).
        state.publicCount = 80
        await create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        await created()
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('reports nothing for a registration that reached no milestone', async () => {
        const { create, created } = setup({ publicCount: 40 })
        await create({ meetup: MEETUP_ID, email: 'erika@example.com' })
        await created()
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })
})

describe('filter meetup_registrations.items.update', () => {
    const cancelledRow = { id: 'reg-1', status: 'cancelled', meetup: MEETUP_ID, email: 'erika@example.com' }

    test('lets cancellations and unrelated edits through without reading anything', async () => {
        const { update, readMany } = setup({ publicCount: 100 })
        await expect(update(['reg-1'], { status: 'cancelled' })).resolves.toEqual({ status: 'cancelled' })
        await expect(update(['reg-1'], { wants_meetup_updates: true })).resolves.toEqual({
            wants_meetup_updates: true,
        })
        expect(readMany).not.toHaveBeenCalled()
    })

    test('a cancellation that also changes the address normalizes it without capacity checks', async () => {
        const { update, readMany } = setup({ publicCount: 100 })
        await expect(update(['reg-1'], { status: 'cancelled', email: ' Max@Lotum.DE ' })).resolves.toEqual({
            status: 'cancelled',
            email: 'max@lotum.de',
            is_internal: true,
        })
        expect(readMany).not.toHaveBeenCalled()
    })

    test('unarchiving takes a spot like a new registration', async () => {
        const open = setup({ publicCount: 99, rows: [cancelledRow] })
        await expect(open.update(['reg-1'], { status: 'confirmed' })).resolves.toEqual({ status: 'confirmed' })

        const full = setup({ publicCount: 100, rows: [cancelledRow] })
        await expect(full.update(['reg-1'], { status: 'confirmed' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_FULL',
        })
    })

    test('a bulk unarchive counts the rows it adds', async () => {
        const { update } = setup({
            publicCount: 99,
            rows: [cancelledRow, { ...cancelledRow, id: 'reg-2', email: 'max@example.com' }],
        })
        await expect(update(['reg-1', 'reg-2'], { status: 'confirmed' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_FULL',
        })
    })

    test('unarchiving an address that has registered again is a duplicate', async () => {
        const { update, readByQuery } = setup({ rows: [cancelledRow], existing: { id: 'reg-9' } })
        await expect(update(['reg-1'], { status: 'confirmed' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_DUPLICATE',
        })
        // The row itself is not its own duplicate.
        expect(readByQuery).toHaveBeenCalledWith(
            expect.objectContaining({ filter: expect.objectContaining({ id: { _neq: 'reg-1' } }) })
        )
    })

    test('turning an internal registration public takes a seat like a new one', async () => {
        const internalRow = { ...cancelledRow, status: 'confirmed', email: 'erika@lotum.de', is_internal: true }
        const full = setup({ publicCount: 100, rows: [internalRow] })
        await expect(full.update(['reg-1'], { email: 'erika@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_FULL',
        })

        const started = setup({ rows: [internalRow] })
        started.state.meetup!.start_on = YESTERDAY
        await expect(started.update(['reg-1'], { email: 'erika@example.com' })).rejects.toMatchObject({
            code: 'MEETUP_REGISTRATION_CLOSED',
        })

        const open = setup({ publicCount: 99, rows: [internalRow] })
        await expect(open.update(['reg-1'], { email: 'erika@example.com' })).resolves.toMatchObject({
            is_internal: false,
        })
    })

    test('fixing the address of a confirmed registration only checks for duplicates', async () => {
        const { state, update } = setup({
            publicCount: 100,
            rows: [{ ...cancelledRow, status: 'confirmed', email: 'erika@exampel.com' }],
        })
        state.meetup!.start_on = YESTERDAY
        await expect(update(['reg-1'], { email: ' Erika@Example.com' })).resolves.toMatchObject({
            email: 'erika@example.com',
            is_internal: false,
        })
    })
})
