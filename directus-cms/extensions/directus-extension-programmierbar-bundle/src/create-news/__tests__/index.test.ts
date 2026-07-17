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

// `shared/errors.ts` imports `@directus/errors`, which ships as ESM and is not
// transformed under Jest's CJS mode. Stub it with a plain Error subclass so the
// publish guard's throw is observable without loading the real dependency.
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

// Action handlers run through `safeAction`, which detaches the work into its own
// promise chain and returns void. Flushing the microtask queue lets that
// detached work (all backed by immediately-resolving mocks) settle before we assert.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type ActionHandler = (metadata: Record<string, any>, eventContext: Record<string, any>) => void
type FilterHandler = (payload: any, metadata: any, context: any) => any

async function invokeAction(
    handler: ActionHandler,
    metadata: Record<string, any>,
    eventContext: Record<string, any> = { accountability: {} }
) {
    handler(metadata, eventContext)
    await flush()
}

interface Recorded {
    createOne: Array<{ collection: string; data: Record<string, any> }>
    updateOne: Array<{ collection: string; id: string | number; data: Record<string, any> }>
    deleteOne: Array<{ collection: string; id: string | number }>
}

interface SetupOptions {
    /** Rows returned by `news_target` readByQuery. */
    junctionRows?: Array<Record<string, any>>
    /** Rows returned by a `news` readByQuery (slug-collision lookup). */
    existingNews?: Array<Record<string, any>>
    /** Rows returned by a `news_links` readByQuery (publish guard). */
    sourceLinks?: Array<Record<string, any>>
    /** Item returned by the `news_links` readOne (title fallback on create). */
    sourceItem?: Record<string, any>
    /** Field definitions returned by FieldsService.readAll. */
    fields?: any[]
    newNewsId?: string
    createOneErrorCollection?: string
}

function setup(options: SetupOptions = {}) {
    const { junctionRows = [], existingNews = [], sourceLinks = [], sourceItem = {}, fields = [], newNewsId = 'news-new' } =
        options

    const recorded: Recorded = { createOne: [], updateOne: [], deleteOne: [] }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation((collection: string) => ({
        readByQuery: jest.fn(async () => {
            if (collection === 'news') return existingNews
            if (collection === 'news_links') return sourceLinks
            return junctionRows
        }),
        readOne: jest.fn(async () => sourceItem),
        createOne: jest.fn(async (data: Record<string, any>) => {
            if (options.createOneErrorCollection === collection) {
                throw new Error(`boom in ${collection}`)
            }
            recorded.createOne.push({ collection, data })
            return collection === 'news' ? newNewsId : 'junction-new'
        }),
        updateOne: jest.fn(async (id: string | number, data: Record<string, any>) => {
            recorded.updateOne.push({ collection, id, data })
            return id
        }),
        deleteOne: jest.fn(async (id: string | number) => {
            recorded.deleteOne.push({ collection, id })
            return id
        }),
    }))

    const FieldsService = jest.fn().mockImplementation(() => ({
        readAll: jest.fn(async () => fields),
    }))

    const actions = new Map<string, ActionHandler>()
    const filters = new Map<string, FilterHandler>()
    const register = {
        action: (event: string, handler: ActionHandler) => {
            actions.set(event, handler)
        },
        filter: (event: string, handler: FilterHandler) => {
            filters.set(event, handler)
        },
    }

    const hookContext = {
        logger,
        services: { ItemsService, FieldsService },
        getSchema: jest.fn(async () => ({})),
        env: { PUBLIC_URL: 'https://cms.example.com/' },
    }

    registerHook(register as any, hookContext as any)

    return { actions, filters, recorded, logger }
}

const filterContext = { schema: {}, accountability: {} }

describe('create-news hook', () => {
    beforeEach(() => {
        postSlackMessageMock.mockClear()
    })

    test('registers the expected filter and action handlers', () => {
        const { actions, filters } = setup()
        expect([...actions.keys()].sort()).toEqual([
            'news.items.update',
            'news_links.items.create',
            'news_links.items.delete',
            'news_links.items.update',
        ])
        expect([...filters.keys()].sort()).toEqual([
            'news.items.delete',
            'news.items.update',
            'news_links.items.create',
        ])
    })

    test('forces new links to draft regardless of the submitted status', () => {
        const { filters } = setup()
        const handler = filters.get('news_links.items.create')!
        expect(handler({ title: 'X', status: 'published' }, {}, filterContext)).toEqual({
            title: 'X',
            status: 'draft',
        })
    })

    test('create: mirrors a link into a draft news item with a slug and wires up the junction', async () => {
        const { actions, recorded } = setup({ newNewsId: 'news-1' })
        const handler = actions.get('news_links.items.create')!

        // The contributor's status is intentionally ignored; the news is draft.
        await invokeAction(handler, { key: 'link-1', payload: { title: 'React 19 Released', status: 'published' } })

        expect(recorded.createOne).toEqual([
            { collection: 'news', data: { status: 'draft', slug: 'react-19-released' } },
            { collection: 'news_target', data: { news_id: 'news-1', collection: 'news_links', target: 'link-1' } },
        ])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('create: appends a numeric suffix when the slug already exists', async () => {
        const { actions, recorded } = setup({
            newNewsId: 'news-2',
            existingNews: [{ id: 'other', slug: 'react-19-released' }],
        })
        const handler = actions.get('news_links.items.create')!

        await invokeAction(handler, { key: 'link-2', payload: { title: 'React 19 Released' } })

        expect(recorded.createOne[0]).toEqual({ collection: 'news', data: { status: 'draft', slug: 'react-19-released-2' } })
    })

    test('create: creates the news without a slug when the title is empty', async () => {
        const { actions, recorded } = setup({ newNewsId: 'news-3' })
        const handler = actions.get('news_links.items.create')!

        await invokeAction(handler, { key: 'link-3', payload: { title: '' } })

        expect(recorded.createOne[0]).toEqual({ collection: 'news', data: { status: 'draft' } })
    })

    test('create: is idempotent when a junction row already exists', async () => {
        const { actions, recorded, logger } = setup({ junctionRows: [{ id: 7 }] })
        const handler = actions.get('news_links.items.create')!

        await invokeAction(handler, { key: 'link-4', payload: { title: 'Anything' } })

        expect(recorded.createOne).toEqual([])
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('already linked'))
    })

    test('create: rolls back the news item when junction creation fails', async () => {
        const { actions, recorded } = setup({ createOneErrorCollection: 'news_target', newNewsId: 'news-9' })
        const handler = actions.get('news_links.items.create')!

        await invokeAction(handler, { key: 'link-9', payload: { title: 'Rollback me' } })

        expect(recorded.deleteOne).toEqual([{ collection: 'news', id: 'news-9' }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
    })

    test('update: re-slugs the parent news when the link title changes', async () => {
        const { actions, recorded } = setup({ junctionRows: [{ news_id: 'news-a' }] })
        const handler = actions.get('news_links.items.update')!

        await invokeAction(handler, { keys: ['link-5'], payload: { title: 'A Brand New Title' } })

        expect(recorded.updateOne).toEqual([{ collection: 'news', id: 'news-a', data: { slug: 'a-brand-new-title' } }])
    })

    test('update: does nothing when the title is not part of the change', async () => {
        const { actions, recorded } = setup({ junctionRows: [{ news_id: 'news-a' }] })
        const handler = actions.get('news_links.items.update')!

        await invokeAction(handler, { keys: ['link-5'], payload: { comment: 'edited' } })

        expect(recorded.updateOne).toEqual([])
    })

    test('delete: removes junction rows and their news items, skipping null news_id', async () => {
        const { actions, recorded } = setup({
            junctionRows: [
                { id: 1, news_id: 'news-a' },
                { id: 2, news_id: null },
            ],
        })
        const handler = actions.get('news_links.items.delete')!

        await invokeAction(handler, { keys: ['link-6'] })

        expect(recorded.deleteOne).toEqual([
            { collection: 'news_target', id: 1 },
            { collection: 'news_target', id: 2 },
            { collection: 'news', id: 'news-a' },
        ])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('news status change: mirrors the new status onto every source link', async () => {
        const { actions, recorded } = setup({ junctionRows: [{ target: 'nl1' }, { target: 'nl2' }] })
        const handler = actions.get('news.items.update')!

        await invokeAction(handler, { keys: ['news1'], payload: { status: 'archived' } })

        expect(recorded.updateOne).toEqual([
            { collection: 'news_links', id: 'nl1', data: { status: 'archived' } },
            { collection: 'news_links', id: 'nl2', data: { status: 'archived' } },
        ])
    })

    test('news status change: does nothing when status is not part of the change', async () => {
        const { actions, recorded } = setup({ junctionRows: [{ target: 'nl1' }] })
        const handler = actions.get('news.items.update')!

        await invokeAction(handler, { keys: ['news1'], payload: { slug: 'edited-elsewhere' } })

        expect(recorded.updateOne).toEqual([])
    })

    describe('publish guard (news.items.update filter)', () => {
        const REQUIRE_LINK_FIELD = [{ field: 'link', schema: { required: true }, meta: {} }]

        test('passes through when the update is not a publish', async () => {
            const { filters } = setup()
            const handler = filters.get('news.items.update')!
            const payload = { slug: 'x' }
            await expect(handler(payload, { keys: ['news1'] }, filterContext)).resolves.toBe(payload)
        })

        test('allows publishing when the source link is complete', async () => {
            const { filters } = setup({
                junctionRows: [{ target: 'nl1' }],
                sourceLinks: [{ id: 'nl1', link: 'https://example.com' }],
                fields: REQUIRE_LINK_FIELD,
            })
            const handler = filters.get('news.items.update')!
            const payload = { status: 'published' }
            await expect(handler(payload, { keys: ['news1'] }, filterContext)).resolves.toBe(payload)
        })

        test('blocks publishing when the source link is missing a required field', async () => {
            const { filters } = setup({
                junctionRows: [{ target: 'nl1' }],
                sourceLinks: [{ id: 'nl1' }],
                fields: REQUIRE_LINK_FIELD,
            })
            const handler = filters.get('news.items.update')!
            await expect(handler({ status: 'published' }, { keys: ['news1'] }, filterContext)).rejects.toThrow()
        })
    })

    test('news delete: archives the source link, drops the junction row, and returns the keys', async () => {
        const { filters, recorded } = setup({ junctionRows: [{ id: 10, target: 'nl1' }] })
        const handler = filters.get('news.items.delete')!

        const result = await handler(['news1'], {}, filterContext)

        expect(recorded.updateOne).toEqual([{ collection: 'news_links', id: 'nl1', data: { status: 'archived' } }])
        expect(recorded.deleteOne).toEqual([{ collection: 'news_target', id: 10 }])
        expect(result).toEqual(['news1'])
    })
})
