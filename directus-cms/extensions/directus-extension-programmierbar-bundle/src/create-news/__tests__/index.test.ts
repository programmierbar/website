import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

// Mock the Slack helper so the hook never reaches out to the network and we can
// assert on failure notifications.
jest.mock('./../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

import { postSlackMessage } from './../../shared/postSlackMessage.ts'
import registerHook from './../index.ts'

const postSlackMessageMock = jest.mocked(postSlackMessage)

// Handlers are registered through `safeAction`, which detaches the work into its
// own promise chain and returns void. Flushing the microtask queue lets that
// detached work (all backed by immediately-resolving mocks) settle before we assert.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type Handler = (metadata: Record<string, any>, eventContext: Record<string, any>) => void

async function invoke(handler: Handler, metadata: Record<string, any>, eventContext: Record<string, any> = { accountability: {} }) {
    handler(metadata, eventContext)
    await flush()
}

interface CreateOneCall {
    collection: string
    data: Record<string, any>
}
interface DeleteOneCall {
    collection: string
    id: string | number
}

interface SetupOptions {
    /** Rows returned by `news_target` readByQuery (idempotency guard / delete lookup). */
    junctionRows?: Array<Record<string, any>>
    /** Item returned by the `news_links` readOne (status fallback). */
    sourceItem?: Record<string, any>
    /** Id assigned to a newly created `news` item. */
    newNewsId?: string
    createOneErrorCollection?: string
    readByQueryError?: Error
}

function setup(options: SetupOptions = {}) {
    const { junctionRows = [], sourceItem = { status: 'draft' }, newNewsId = 'news-new' } = options

    const createOneCalls: CreateOneCall[] = []
    const deleteOneCalls: DeleteOneCall[] = []
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation((collection: string) => ({
        readByQuery: jest.fn(async () => {
            if (options.readByQueryError) {
                throw options.readByQueryError
            }
            return junctionRows
        }),
        readOne: jest.fn(async () => sourceItem),
        createOne: jest.fn(async (data: Record<string, any>) => {
            if (options.createOneErrorCollection === collection) {
                throw new Error(`boom in ${collection}`)
            }
            createOneCalls.push({ collection, data })
            return collection === 'news' ? newNewsId : 'junction-new'
        }),
        deleteOne: jest.fn(async (id: string | number) => {
            deleteOneCalls.push({ collection, id })
            return id
        }),
    }))

    const handlers = new Map<string, Handler>()
    const register = {
        action: (event: string, handler: Handler) => {
            handlers.set(event, handler)
        },
    }

    const hookContext = {
        logger,
        services: { ItemsService },
        getSchema: jest.fn(async () => ({})),
        env: { PUBLIC_URL: 'https://cms.example.com/' },
    }

    registerHook(register as any, hookContext as any)

    return { handlers, createOneCalls, deleteOneCalls, logger }
}

describe('create-news hook', () => {
    beforeEach(() => {
        postSlackMessageMock.mockClear()
    })

    test('registers create and delete actions for news_links', () => {
        const { handlers } = setup()
        expect(handlers.has('news_links.items.create')).toBe(true)
        expect(handlers.has('news_links.items.delete')).toBe(true)
    })

    test('create: mirrors the payload status into a news item and wires up the junction', async () => {
        const { handlers, createOneCalls } = setup({ newNewsId: 'news-1' })
        const handler = handlers.get('news_links.items.create')!

        await invoke(handler, { key: 'link-1', payload: { status: 'published' } })

        expect(createOneCalls).toEqual([
            { collection: 'news', data: { status: 'published' } },
            { collection: 'news_target', data: { news_id: 'news-1', collection: 'news_links', target: 'link-1' } },
        ])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('create: falls back to the persisted status when the payload omits it', async () => {
        const { handlers, createOneCalls } = setup({ sourceItem: { status: 'archived' }, newNewsId: 'news-2' })
        const handler = handlers.get('news_links.items.create')!

        await invoke(handler, { key: 'link-2', payload: {} })

        expect(createOneCalls[0]).toEqual({ collection: 'news', data: { status: 'archived' } })
    })

    test('create: is idempotent when a junction row already exists', async () => {
        const { handlers, createOneCalls, logger } = setup({ junctionRows: [{ id: 7, news_id: 'news-x' }] })
        const handler = handlers.get('news_links.items.create')!

        await invoke(handler, { key: 'link-3', payload: { status: 'draft' } })

        expect(createOneCalls).toEqual([])
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('already linked'))
    })

    test('create: notifies Slack with an admin link when creation fails', async () => {
        const { handlers, logger } = setup({ createOneErrorCollection: 'news' })
        const handler = handlers.get('news_links.items.create')!

        await invoke(handler, { key: 'link-4', payload: { status: 'draft' } })

        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(postSlackMessageMock).toHaveBeenCalledWith(
            expect.stringContaining('https://cms.example.com/admin/content/news_links/link-4')
        )
        expect(logger.error).toHaveBeenCalled()
    })

    test('create: rolls back the news item when junction creation fails', async () => {
        const { handlers, deleteOneCalls } = setup({ createOneErrorCollection: 'news_target', newNewsId: 'news-9' })
        const handler = handlers.get('news_links.items.create')!

        await invoke(handler, { key: 'link-9', payload: { status: 'draft' } })

        // The orphaned news row must be deleted so a retry doesn't accumulate orphans.
        expect(deleteOneCalls).toEqual([{ collection: 'news', id: 'news-9' }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
    })

    test('delete: removes junction rows and their news items, skipping null news_id', async () => {
        const { handlers, deleteOneCalls } = setup({
            junctionRows: [
                { id: 1, news_id: 'news-a' },
                { id: 2, news_id: null },
            ],
        })
        const handler = handlers.get('news_links.items.delete')!

        await invoke(handler, { keys: ['link-5'] })

        expect(deleteOneCalls).toEqual([
            { collection: 'news_target', id: 1 },
            { collection: 'news_target', id: 2 },
            { collection: 'news', id: 'news-a' },
        ])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('delete: does nothing when no junction row references the link', async () => {
        const { handlers, deleteOneCalls } = setup({ junctionRows: [] })
        const handler = handlers.get('news_links.items.delete')!

        await invoke(handler, { keys: ['link-6'] })

        expect(deleteOneCalls).toEqual([])
    })
})
