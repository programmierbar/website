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

/** A field that is required in the schema, as consumed by `isPublishable`. */
function requiredField(name: string) {
    return { field: name, schema: { required: true }, meta: { conditions: null } }
}

interface SetupOptions {
    /** Parent item returned by the parent collection's `readOne` (nested relation data). */
    parentItem?: Record<string, any>
    /** Full child items returned by a target collection's `readByQuery`, keyed by collection. */
    childItemsByCollection?: Record<string, Array<Record<string, any>>>
    /** Field definitions returned by `FieldsService.readAll`, keyed by collection. */
    fieldsByCollection?: Record<string, Array<Record<string, any>>>
    getSchemaError?: Error
    readOneError?: Error
    readByQueryError?: Error
    updateOneError?: Error
}

function setup(options: SetupOptions = {}) {
    const { parentItem = {}, childItemsByCollection = {}, fieldsByCollection = {} } = options
    // Children are published one-at-a-time via updateOne (see ADR 0002), so we record
    // individual publish calls.
    const updateOneCalls: Array<{ collection: string; id: string | number; data: Record<string, any> }> = []
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation((collection: string) => ({
        readOne: jest.fn(async () => {
            if (options.readOneError) {
                throw options.readOneError
            }
            return parentItem
        }),
        readByQuery: jest.fn(async (query: Record<string, any>) => {
            if (options.readByQueryError) {
                throw options.readByQueryError
            }
            const ids: Array<string | number> = query?.filter?.id?._in ?? []
            const provided = childItemsByCollection[collection]
            if (provided) {
                return provided.filter((item) => ids.includes(item.id))
            }
            // Default: each requested id resolves to a complete draft item.
            return ids.map((id) => ({ id, status: 'draft' }))
        }),
        updateOne: jest.fn(async (id: string | number, data: Record<string, any>) => {
            if (options.updateOneError) {
                throw options.updateOneError
            }
            updateOneCalls.push({ collection, id, data })
            return id
        }),
    }))

    const FieldsService = jest.fn().mockImplementation(() => ({
        readAll: jest.fn(async (collection: string) => fieldsByCollection[collection] ?? []),
    }))

    const handlers = new Map<string, Handler>()
    const register = {
        action: (event: string, handler: Handler) => {
            handlers.set(event, handler)
        },
    }

    const hookContext = {
        logger,
        services: { ItemsService, FieldsService },
        getSchema: jest.fn(async () => {
            if (options.getSchemaError) {
                throw options.getSchemaError
            }
            return {}
        }),
        env: { PUBLIC_URL: 'https://cms.example.com/' },
    }

    registerHook(register as any, hookContext as any)

    return { handlers, updateOneCalls, logger }
}

describe('cascade-publish hook', () => {
    beforeEach(() => {
        postSlackMessageMock.mockClear()
    })

    test('registers create and update actions for podcasts and meetups', () => {
        const { handlers } = setup()

        expect([...handlers.keys()].sort()).toEqual([
            'meetups.items.create',
            'meetups.items.update',
            'podcasts.items.create',
            'podcasts.items.update',
        ])
    })

    test('publishes draft speakers and picks when a podcast is published', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: {
                speakers: [
                    { speaker: { id: 'sp1', status: 'draft' } },
                    { speaker: { id: 'sp2', status: 'published' } },
                ],
                picks_of_the_day: [{ id: 'pick1', status: 'draft' }],
            },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        expect(updateOneCalls).toEqual([
            { collection: 'speakers', id: 'sp1', data: { status: 'published' } },
            { collection: 'picks_of_the_day', id: 'pick1', data: { status: 'published' } },
        ])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('publishes draft speakers and talks when a meetup is published', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: {
                speakers: [{ speaker: { id: 'sp1', status: 'draft' } }],
                talks: [{ talk: { id: 't1', status: 'draft' } }],
            },
        })

        await invoke(handlers.get('meetups.items.create')!, { key: 'meetup1', payload: { status: 'published' } })

        expect(updateOneCalls).toEqual([
            { collection: 'speakers', id: 'sp1', data: { status: 'published' } },
            { collection: 'talks', id: 't1', data: { status: 'published' } },
        ])
    })

    test('publishes each child individually so downstream hooks see every key', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: {
                speakers: [
                    { speaker: { id: 'sp1', status: 'draft' } },
                    { speaker: { id: 'sp2', status: 'draft' } },
                    { speaker: { id: 'sp3', status: 'draft' } },
                ],
                picks_of_the_day: [],
            },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        // One updateOne per speaker — never a single batched updateMany.
        expect(updateOneCalls).toEqual([
            { collection: 'speakers', id: 'sp1', data: { status: 'published' } },
            { collection: 'speakers', id: 'sp2', data: { status: 'published' } },
            { collection: 'speakers', id: 'sp3', data: { status: 'published' } },
        ])
    })

    test('does nothing when the payload status is not published', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }] },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'draft' } })

        expect(updateOneCalls).toEqual([])
    })

    test('does not publish when there are no draft children', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: {
                speakers: [{ speaker: { id: 'sp1', status: 'published' } }],
                picks_of_the_day: [],
            },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        expect(updateOneCalls).toEqual([])
    })

    test('does not change archived related items', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: {
                speakers: [
                    { speaker: { id: 'sp1', status: 'archived' } },
                    { speaker: { id: 'sp2', status: 'draft' } },
                ],
                picks_of_the_day: [{ id: 'pick1', status: 'archived' }],
            },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        // Only the draft speaker is published; the archived speaker and archived pick are untouched.
        expect(updateOneCalls).toEqual([{ collection: 'speakers', id: 'sp2', data: { status: 'published' } }])
    })

    test('warns and skips when no key is present', async () => {
        const { handlers, updateOneCalls, logger } = setup({ parentItem: {} })

        await invoke(handlers.get('podcasts.items.update')!, { payload: { status: 'published' } })

        expect(updateOneCalls).toEqual([])
        expect(logger.warn).toHaveBeenCalled()
    })

    test('sends a Slack notification when cascading fails', async () => {
        const { handlers, logger } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }], picks_of_the_day: [] },
            updateOneError: new Error('DB exploded'),
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        expect(logger.error).toHaveBeenCalled()
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const message = postSlackMessageMock.mock.calls[0]?.[0]
        expect(message).toContain('pod1')
        expect(message).toContain('DB exploded')
        expect(message).toContain('https://cms.example.com/admin/content/podcasts/pod1')
    })

    test('processes every key for a multi-key (batch) parent update', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }], picks_of_the_day: [] },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1', 'pod2'], payload: { status: 'published' } })

        expect(updateOneCalls).toEqual([
            { collection: 'speakers', id: 'sp1', data: { status: 'published' } },
            { collection: 'speakers', id: 'sp1', data: { status: 'published' } },
        ])
    })

    test('skips children missing required fields and notifies via Slack', async () => {
        const { handlers, updateOneCalls, logger } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }], picks_of_the_day: [] },
            // The default child item has no `first_name`, so it fails the publishability guard.
            fieldsByCollection: { speakers: [requiredField('first_name')] },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        expect(updateOneCalls).toEqual([])
        expect(logger.warn).toHaveBeenCalled()
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const message = postSlackMessageMock.mock.calls[0]?.[0]
        expect(message).toContain('Pflichtfelder')
        expect(message).toContain('https://cms.example.com/admin/content/speakers/sp1')
    })

    test('publishes complete children while skipping incomplete ones in the same relation', async () => {
        const { handlers, updateOneCalls } = setup({
            parentItem: {
                speakers: [
                    { speaker: { id: 'sp1', status: 'draft' } },
                    { speaker: { id: 'sp2', status: 'draft' } },
                ],
                picks_of_the_day: [],
            },
            fieldsByCollection: { speakers: [requiredField('first_name')] },
            childItemsByCollection: {
                speakers: [
                    { id: 'sp1', status: 'draft', first_name: 'Ada' }, // complete
                    { id: 'sp2', status: 'draft' }, // missing first_name
                ],
            },
        })

        await invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })

        // Only the complete speaker is published.
        expect(updateOneCalls).toEqual([{ collection: 'speakers', id: 'sp1', data: { status: 'published' } }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(postSlackMessageMock.mock.calls[0]?.[0]).toContain('https://cms.example.com/admin/content/speakers/sp2')
    })

    test('notifies Slack (not just logs) when reading the parent fails', async () => {
        const { handlers, updateOneCalls, logger } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }] },
            readOneError: new Error('cannot read parent'),
        })

        // Reading the parent happens before the per-relation try/catch. The per-key guard must
        // catch it, notify Slack, and never let it escape the action handler.
        await expect(
            invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1'], payload: { status: 'published' } })
        ).resolves.toBeUndefined()

        expect(updateOneCalls).toEqual([])
        expect(logger.error).toHaveBeenCalled()
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const message = postSlackMessageMock.mock.calls[0]?.[0]
        expect(message).toContain('cannot read parent')
        expect(message).toContain('https://cms.example.com/admin/content/podcasts/pod1')
    })

    test('notifies Slack when loading the schema fails', async () => {
        const { handlers, updateOneCalls, logger } = setup({
            getSchemaError: new Error('schema unavailable'),
        })

        await expect(
            invoke(handlers.get('podcasts.items.update')!, { keys: ['pod1', 'pod2'], payload: { status: 'published' } })
        ).resolves.toBeUndefined()

        expect(updateOneCalls).toEqual([])
        expect(logger.error).toHaveBeenCalled()
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const message = postSlackMessageMock.mock.calls[0]?.[0]
        expect(message).toContain('schema unavailable')
        expect(message).toContain('pod1')
        expect(message).toContain('pod2')
    })
})
