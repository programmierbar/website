import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

// Mock axios so no real network request is made; assert on the fetch instead.
jest.mock('axios', () => ({
    __esModule: true,
    default: { get: jest.fn() },
}))

// Mock the Slack helper so the hook never reaches out to the network.
jest.mock('./../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

// Mock the SSRF guard so unit tests don't perform real DNS lookups; its own
// behaviour is covered in util/__tests__/urlSafety.test.ts.
jest.mock('./../util/urlSafety.ts', () => ({
    assertPublicUrl: jest.fn(),
}))

import { default as axios } from 'axios'
import { postSlackMessage } from './../../shared/postSlackMessage.ts'
import { assertPublicUrl } from './../util/urlSafety.ts'
import registerHook from './../index.ts'

const axiosGet = (axios as any).get as jest.Mock
const postSlackMessageMock = jest.mocked(postSlackMessage)
const assertPublicUrlMock = jest.mocked(assertPublicUrl)

// safeAction detaches the work into its own promise chain and returns void.
// Flushing the microtask queue lets that detached work settle before we assert.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type Handler = (metadata: Record<string, any>, context: Record<string, any>) => void

async function invoke(handler: Handler, meta: Record<string, any>, context: Record<string, any> = { accountability: {}, schema: {} }) {
    handler(meta, context)
    await flush()
}

const OG_HTML = `
<html><head>
  <meta property="og:title" content="OG Title" />
  <meta property="og:image" content="https://cdn.example.com/img.jpg" />
</head></html>
`

function setup() {
    const updateOneCalls: Array<{ id: string | number; data: Record<string, any> }> = []
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation(() => ({
        updateOne: jest.fn(async (id: string | number, data: Record<string, any>) => {
            updateOneCalls.push({ id, data })
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
        env: { PUBLIC_URL: 'https://cms.example.com/' },
    }

    registerHook(register as any, hookContext as any)

    return { handlers, updateOneCalls, logger }
}

describe('fetch-open-graph hook', () => {
    beforeEach(() => {
        axiosGet.mockReset()
        postSlackMessageMock.mockClear()
        assertPublicUrlMock.mockReset()
        assertPublicUrlMock.mockResolvedValue(undefined)
    })

    test('registers create and update actions for news_links', () => {
        const { handlers } = setup()
        expect(handlers.has('news_links.items.create')).toBe(true)
        expect(handlers.has('news_links.items.update')).toBe(true)
    })

    test('fetches the URL and stores the parsed Open Graph data', async () => {
        axiosGet.mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: OG_HTML })
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.create')!, { key: 'link-1', payload: { link: 'https://example.com/a' } })

        expect(axiosGet).toHaveBeenCalledWith('https://example.com/a', expect.objectContaining({ timeout: expect.any(Number) }))
        expect(updateOneCalls).toHaveLength(1)
        expect(updateOneCalls[0].id).toBe('link-1')
        expect(updateOneCalls[0].data.open_graph.title).toBe('OG Title')
        expect(updateOneCalls[0].data.open_graph.raw['og:image']).toBe('https://cdn.example.com/img.jpg')
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('does nothing when the payload has no link (loop avoidance)', async () => {
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.update')!, { key: 'link-2', payload: { open_graph: { title: 'x' } } })

        expect(axiosGet).not.toHaveBeenCalled()
        expect(updateOneCalls).toEqual([])
    })

    test('notifies Slack and clears open_graph when the fetch fails', async () => {
        axiosGet.mockRejectedValue(new Error('ECONNREFUSED'))
        const { handlers, updateOneCalls, logger } = setup()

        await invoke(handlers.get('news_links.items.create')!, { key: 'link-3', payload: { link: 'https://bad.example' } })

        // Still writes an empty object so stale data isn't retained for the new link.
        expect(updateOneCalls).toEqual([{ id: 'link-3', data: { open_graph: {} } }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(postSlackMessageMock).toHaveBeenCalledWith(
            expect.stringContaining('https://cms.example.com/admin/content/news_links/link-3')
        )
        expect(logger.error).toHaveBeenCalled()
    })

    test('notifies Slack and clears open_graph on an HTTP error status', async () => {
        axiosGet.mockResolvedValue({ status: 404, headers: { 'content-type': 'text/html' }, data: '' })
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.create')!, { key: 'link-4', payload: { link: 'https://example.com/missing' } })

        expect(updateOneCalls).toEqual([{ id: 'link-4', data: { open_graph: {} } }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
    })

    test('clears open_graph (empty object) for non-HTML responses without notifying', async () => {
        axiosGet.mockResolvedValue({ status: 200, headers: { 'content-type': 'application/pdf' }, data: '%PDF' })
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.create')!, { key: 'link-5', payload: { link: 'https://example.com/file.pdf' } })

        // Not an error, so no Slack — but still write {} to avoid stale data.
        expect(updateOneCalls).toEqual([{ id: 'link-5', data: { open_graph: {} } }])
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('blocks unsafe URLs (SSRF guard) without fetching', async () => {
        assertPublicUrlMock.mockRejectedValue(new Error('Refusing to fetch internal host: localhost'))
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.create')!, { key: 'link-6', payload: { link: 'http://localhost/admin' } })

        expect(axiosGet).not.toHaveBeenCalled()
        expect(updateOneCalls).toEqual([{ id: 'link-6', data: { open_graph: {} } }])
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
    })

    test('resolves relative og:image against the final redirected URL', async () => {
        axiosGet.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'text/html' },
            data: '<meta property="og:image" content="/img/pic.jpg">',
            request: { res: { responseUrl: 'https://redirected.example.com/final' } },
        })
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.create')!, { key: 'link-7', payload: { link: 'https://example.com/start' } })

        expect(updateOneCalls[0].data.open_graph.image).toBe('https://redirected.example.com/img/pic.jpg')
    })

    test('writes to every key of a batched update', async () => {
        axiosGet.mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: OG_HTML })
        const { handlers, updateOneCalls } = setup()

        await invoke(handlers.get('news_links.items.update')!, { keys: ['a', 'b'], payload: { link: 'https://example.com/shared' } })

        expect(axiosGet).toHaveBeenCalledTimes(1)
        expect(updateOneCalls.map((c) => c.id)).toEqual(['a', 'b'])
    })
})
