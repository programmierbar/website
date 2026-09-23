import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

// Slack helper mocked so the hook never hits the network and we can assert on it.
jest.mock('./../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

// `shared/errors.ts` imports `@directus/errors` (ESM), which Jest can't parse.
jest.mock('./../../shared/errors.ts', () => ({
    createHookErrorConstructor: (_hook: string, message: string) =>
        class extends Error {
            constructor() {
                super(message)
            }
        },
}))

import { postSlackMessage } from './../../shared/postSlackMessage.ts'
import registerHook from './../index.ts'

const postSlackMessageMock = jest.mocked(postSlackMessage)

interface UpdateCall {
    id: string | number
    data: Record<string, any>
}

interface SetupOptions {
    /** Draft, due items returned by readByQuery for the `news` collection. */
    dueItems?: Array<Record<string, any>>
    /** Field definitions returned by FieldsService.readAll. */
    fields?: any[]
    /** When set, updateOne rejects for a `{ status: 'published' }` payload. */
    rejectPublish?: boolean
}

function setup(options: SetupOptions = {}) {
    const { dueItems = [], fields = [], rejectPublish = false } = options

    const updateCalls: UpdateCall[] = []
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation(() => ({
        readByQuery: jest.fn(async () => dueItems),
        updateOne: jest.fn(async (id: string | number, data: Record<string, any>) => {
            if (rejectPublish && data.status === 'published') {
                throw new Error('downstream hook rejected the publish')
            }
            updateCalls.push({ id, data })
            return id
        }),
    }))

    const FieldsService = jest.fn().mockImplementation(() => ({
        readAll: jest.fn(async () => fields),
    }))

    const globalSchema = {
        collections: {
            news: {
                singleton: false,
                primary: 'id',
                fields: { status: {}, published_on: {} },
            },
        },
    }

    let scheduled: (() => Promise<void>) | undefined
    const register = {
        schedule: (_cron: string, callback: () => Promise<void>) => {
            scheduled = callback
        },
    }

    const hookContext = {
        logger,
        services: { ItemsService, FieldsService },
        getSchema: jest.fn(async () => globalSchema),
        env: { PUBLIC_URL: 'https://cms.example.com/' },
    }

    registerHook(register as any, hookContext as any)

    return { runSchedule: () => scheduled!(), updateCalls, logger }
}

// A field that is required on the schema, so an item lacking it is not publishable.
const REQUIRE_LINK_FIELD = [{ field: 'link', schema: { required: true }, meta: {} }]

describe('schedule-publication hook', () => {
    beforeEach(() => {
        postSlackMessageMock.mockClear()
    })

    test('publishes a due item whose required fields are set', async () => {
        const { runSchedule, updateCalls } = setup({
            dueItems: [{ id: 'news-1', link: 'https://example.com' }],
            fields: REQUIRE_LINK_FIELD,
        })

        await runSchedule()

        expect(updateCalls).toEqual([{ id: 'news-1', data: { status: 'published' } }])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('de-schedules and notifies when a due item is missing a required field', async () => {
        const { runSchedule, updateCalls } = setup({
            dueItems: [{ id: 'news-2' }],
            fields: REQUIRE_LINK_FIELD,
        })

        await runSchedule()

        // Not published; published_on nulled so it drops out of the next run.
        expect(updateCalls).toEqual([{ id: 'news-2', data: { published_on: null } }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('news-2'))
    })

    test('de-schedules and notifies when a downstream hook rejects the publish', async () => {
        const { runSchedule, updateCalls, logger } = setup({
            dueItems: [{ id: 'news-3', link: 'https://example.com' }],
            fields: REQUIRE_LINK_FIELD,
            rejectPublish: true,
        })

        await runSchedule()

        // The publish threw; it must not fail the run — instead the item is
        // de-scheduled (published_on nulled) and the team is notified once.
        expect(updateCalls).toEqual([{ id: 'news-3', data: { published_on: null } }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('downstream hook rejected the publish'))
    })

    test('does nothing when no items are due', async () => {
        const { runSchedule, updateCalls } = setup({ dueItems: [] })

        await runSchedule()

        expect(updateCalls).toEqual([])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })
})
