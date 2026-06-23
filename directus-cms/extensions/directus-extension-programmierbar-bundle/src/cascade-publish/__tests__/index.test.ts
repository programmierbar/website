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

interface ActionHandler {
    (metadata: Record<string, any>, eventContext: Record<string, any>): Promise<void>
}

/**
 * Build a mock ItemsService whose `readOne` returns the configured parent item
 * for the parent collection and whose `updateMany` records its calls so tests
 * can assert what was published.
 */
function setup(options: { parentItem?: Record<string, any>; updateManyError?: Error } = {}) {
    const updateManyCalls: Array<{ collection: string; keys: string[]; data: Record<string, any> }> = []
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation((collection: string) => ({
        readOne: jest.fn(async () => options.parentItem ?? {}),
        updateMany: jest.fn(async (keys: string[], data: Record<string, any>) => {
            if (options.updateManyError) {
                throw options.updateManyError
            }
            updateManyCalls.push({ collection, keys, data })
            return keys
        }),
    }))

    const handlers = new Map<string, ActionHandler>()
    const register = {
        action: (event: string, handler: ActionHandler) => {
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

    const eventContext = { accountability: { admin: true } }

    return { handlers, updateManyCalls, logger, eventContext }
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
        const { handlers, updateManyCalls } = setup({
            parentItem: {
                speakers: [
                    { speaker: { id: 'sp1', status: 'draft' } },
                    { speaker: { id: 'sp2', status: 'published' } },
                ],
                picks_of_the_day: [{ id: 'pick1', status: 'draft' }],
            },
        })

        await handlers.get('podcasts.items.update')!({ keys: ['pod1'], payload: { status: 'published' } }, { accountability: {} })

        expect(updateManyCalls).toEqual([
            { collection: 'speakers', keys: ['sp1'], data: { status: 'published' } },
            { collection: 'picks_of_the_day', keys: ['pick1'], data: { status: 'published' } },
        ])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('publishes draft speakers and talks when a meetup is published', async () => {
        const { handlers, updateManyCalls } = setup({
            parentItem: {
                speakers: [{ speaker: { id: 'sp1', status: 'draft' } }],
                talks: [{ talk: { id: 't1', status: 'draft' } }],
            },
        })

        await handlers.get('meetups.items.create')!({ key: 'meetup1', payload: { status: 'published' } }, { accountability: {} })

        expect(updateManyCalls).toEqual([
            { collection: 'speakers', keys: ['sp1'], data: { status: 'published' } },
            { collection: 'talks', keys: ['t1'], data: { status: 'published' } },
        ])
    })

    test('does nothing when the payload status is not published', async () => {
        const { handlers, updateManyCalls } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }] },
        })

        await handlers.get('podcasts.items.update')!({ keys: ['pod1'], payload: { status: 'draft' } }, { accountability: {} })

        expect(updateManyCalls).toEqual([])
    })

    test('does not publish when there are no draft children', async () => {
        const { handlers, updateManyCalls } = setup({
            parentItem: {
                speakers: [{ speaker: { id: 'sp1', status: 'published' } }],
                picks_of_the_day: [],
            },
        })

        await handlers.get('podcasts.items.update')!({ keys: ['pod1'], payload: { status: 'published' } }, { accountability: {} })

        expect(updateManyCalls).toEqual([])
    })

    test('warns and skips when no key is present', async () => {
        const { handlers, updateManyCalls, logger } = setup({ parentItem: {} })

        await handlers.get('podcasts.items.update')!({ payload: { status: 'published' } }, { accountability: {} })

        expect(updateManyCalls).toEqual([])
        expect(logger.warn).toHaveBeenCalled()
    })

    test('sends a Slack notification when cascading fails', async () => {
        const { handlers, logger } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }], picks_of_the_day: [] },
            updateManyError: new Error('DB exploded'),
        })

        await handlers.get('podcasts.items.update')!({ keys: ['pod1'], payload: { status: 'published' } }, { accountability: {} })

        expect(logger.error).toHaveBeenCalled()
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const message = postSlackMessageMock.mock.calls[0][0]
        expect(message).toContain('pod1')
        expect(message).toContain('DB exploded')
        expect(message).toContain('https://cms.example.com/admin/content/podcasts/pod1')
    })

    test('processes every key for a multi-key (batch) update', async () => {
        const { handlers, updateManyCalls } = setup({
            parentItem: { speakers: [{ speaker: { id: 'sp1', status: 'draft' } }], picks_of_the_day: [] },
        })

        await handlers.get('podcasts.items.update')!({ keys: ['pod1', 'pod2'], payload: { status: 'published' } }, { accountability: {} })

        expect(updateManyCalls).toEqual([
            { collection: 'speakers', keys: ['sp1'], data: { status: 'published' } },
            { collection: 'speakers', keys: ['sp1'], data: { status: 'published' } },
        ])
    })
})
