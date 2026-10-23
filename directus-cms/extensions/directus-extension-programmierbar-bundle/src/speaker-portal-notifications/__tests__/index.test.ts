import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { deliverTemplatedEmail } from '../../shared/email-service.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerHook from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

jest.mock('../../shared/email-service.ts', () => ({
    deliverTemplatedEmail: jest.fn(),
    formatDateGerman: (date: string) => `formatted:${date}`,
}))

jest.mock('../../shared/postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))

const sendMock = jest.mocked(deliverTemplatedEmail)
const slackMock = jest.mocked(postSlackMessage)

// Handlers are registered through `safeAction`, which detaches the work into its own promise
// chain. Flushing lets that work (backed by immediately-resolving fakes) settle.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type Handler = (metadata: Record<string, any>, eventContext: Record<string, any>) => void

interface Db {
    speakers: any[]
    directus_versions: any[]
}

function setup(db: Partial<Db>, options: { readManyError?: Error } = {}) {
    const tables: Db = { speakers: [], directus_versions: [], ...db }
    const versionQueries: any[] = []

    class FakeItemsService {
        collection: string
        constructor(collection: string) {
            this.collection = collection
        }
        async readOne(id: any) {
            const row = (tables as any)[this.collection]?.find((r: any) => r.id === id)
            if (!row) throw new Error('not found')
            return { ...row }
        }
        async readMany(ids: any[]) {
            if (options.readManyError) throw options.readManyError
            return (tables as any)[this.collection].filter((r: any) => ids.includes(r.id)).map((r: any) => ({ ...r }))
        }
        async readByQuery(query: any) {
            if (this.collection === 'directus_versions') {
                versionQueries.push(query)
                const { collection, item, key } = query.filter
                return tables.directus_versions.filter(
                    (v) => v.collection === collection._eq && v.item === item._eq && v.key === key._eq
                )
            }
            if (this.collection === 'automation_settings') return [{ value: 'https://www.programmier.bar' }]
            return []
        }
    }

    const actions = new Map<string, Handler[]>()
    const filters = new Map<string, Array<(payload: any, meta: any, ctx: any) => any>>()
    const register = {
        action: (event: string, handler: Handler) => actions.set(event, [...(actions.get(event) ?? []), handler]),
        filter: (event: string, handler: any) => filters.set(event, [...(filters.get(event) ?? []), handler]),
        schedule: jest.fn(),
    }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    ;(registerHook as any)(register, {
        logger,
        services: { ItemsService: FakeItemsService, MailService: jest.fn() },
        getSchema: async () => ({}),
        env: { PUBLIC_URL: 'https://admin.example.com/' },
    })

    /** Mirrors a Directus update: filters see the old row, then the write lands, then actions run. */
    async function update(payload: Record<string, any>, keys: string[]) {
        for (const handler of filters.get('speakers.items.update') ?? []) {
            payload = await handler(payload, { keys, collection: 'speakers' }, { schema: {}, database: {} })
        }
        for (const row of tables.speakers) {
            if (keys.includes(row.id)) Object.assign(row, payload)
        }
        for (const handler of actions.get('speakers.items.update') ?? []) {
            handler({ payload, keys }, { accountability: { user: 'website-token' } })
        }
        await flush()
        await flush()
    }

    return { update, versionQueries, logger, tables }
}

const SPEAKER = {
    id: 'speaker-1',
    first_name: 'Erika',
    last_name: 'Mustermann',
    email: 'erika@example.com',
    portal_token: 'new-token',
    portal_submission_deadline: null,
    portal_submission_status: 'update_requested',
}

beforeEach(() => {
    sendMock.mockReset().mockResolvedValue('sent')
    slackMock.mockReset().mockResolvedValue(undefined)
})

describe('speaker-portal-notifications', () => {
    test('a token write with status update_requested does not send the new-speaker invitation', async () => {
        // Defence in depth: the request endpoint writes with emitEvents: false, but even if the
        // update action ran, the invitation only goes out while the status is `pending`.
        const { update } = setup({ speakers: [SPEAKER] })
        await update({ portal_token: 'new-token', portal_submission_status: 'update_requested' }, ['speaker-1'])

        expect(sendMock).not.toHaveBeenCalled()
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('a submission answering an update request is announced as Profil-Update, with the version', async () => {
        const { update, versionQueries } = setup({
            speakers: [{ ...SPEAKER }],
            directus_versions: [
                {
                    collection: 'speakers',
                    item: 'speaker-1',
                    key: 'profile-update',
                    name: 'Profil-Update 20.10.2026',
                },
            ],
        })
        await update({ portal_submission_status: 'submitted', portal_token: null }, ['speaker-1'])

        expect(versionQueries[0].filter).toEqual({
            collection: { _eq: 'speakers' },
            item: { _eq: 'speaker-1' },
            key: { _eq: 'profile-update' },
        })
        expect(slackMock).toHaveBeenCalledTimes(1)
        const text = slackMock.mock.calls[0][0]
        expect(text).toContain('Profil-Update')
        expect(text).toContain('„Profil-Update 20.10.2026“')
        expect(text).toContain('https://admin.example.com/admin/content/speakers/speaker-1?version=profile-update')
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                templateKey: 'speaker_submission_confirmation',
                data: expect.objectContaining({ is_update: true, is_initial: false }),
            }),
            expect.anything()
        )
    })

    test('an old profile-update version does not turn a first submission into an update', async () => {
        // The deterministic signal is the status before the write, not whether a version exists.
        const { update } = setup({
            speakers: [{ ...SPEAKER, portal_submission_status: 'pending' }],
            directus_versions: [{ collection: 'speakers', item: 'speaker-1', key: 'profile-update', name: 'alt' }],
        })
        await update({ portal_submission_status: 'submitted', portal_token: null }, ['speaker-1'])

        expect(slackMock.mock.calls[0][0]).toMatch(/^:white_check_mark: \*Speaker Portal\*: Erika Mustermann hat/)
        expect(sendMock.mock.calls[0][0].data).toMatchObject({ is_update: false, is_initial: true })
    })

    test('the mark is used once: a later submission is not an update again', async () => {
        const { update, tables } = setup({ speakers: [{ ...SPEAKER }] })
        await update({ portal_submission_status: 'submitted', portal_token: null }, ['speaker-1'])
        // e.g. an admin re-saves the status by hand later
        tables.speakers[0].portal_submission_status = 'pending'
        await update({ portal_submission_status: 'submitted' }, ['speaker-1'])

        expect(slackMock).toHaveBeenCalledTimes(2)
        expect(slackMock.mock.calls[0][0]).toContain('Profil-Update')
        expect(slackMock.mock.calls[1][0]).not.toContain('Profil-Update')
    })

    test('a failing status read never blocks the write and hedges the Slack message', async () => {
        const { update, logger } = setup({ speakers: [{ ...SPEAKER }] }, { readManyError: new Error('db down') })
        await update({ portal_submission_status: 'submitted', portal_token: null }, ['speaker-1'])

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('previous submission status'))
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0][0]).toContain('konnte nicht geprüft werden')
    })

    test('other updates pass the filter untouched without reading anything', async () => {
        const { update, logger } = setup({ speakers: [{ ...SPEAKER }] }, { readManyError: new Error('unused') })
        await update({ occupation: 'CTO' }, ['speaker-1'])
        expect(logger.error).not.toHaveBeenCalled()
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('a first submission keeps the existing Slack message', async () => {
        const { update } = setup({
            speakers: [{ ...SPEAKER, portal_submission_status: 'pending' }],
        })
        await update({ portal_submission_status: 'submitted', portal_token: null }, ['speaker-1'])

        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0][0]).toMatch(/^:white_check_mark: \*Speaker Portal\*: Erika Mustermann hat/)
    })
})
