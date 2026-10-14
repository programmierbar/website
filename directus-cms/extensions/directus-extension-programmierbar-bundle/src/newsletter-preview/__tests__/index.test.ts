import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getRequiredSetting } from '../../shared/settings.ts'
import { checkAdminAccess } from '../access.ts'
import registerEndpoint from '../index.ts'
import { buildPreviewNotice, injectPreviewNotice } from '../notice.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineEndpoint` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineEndpoint: (callback: unknown) => callback,
}))

jest.mock('../../shared/settings.ts', () => ({
    getRequiredSetting: jest.fn(),
}))

const getRequiredSettingMock = jest.mocked(getRequiredSetting)

type RouteHandler = (req: any, res: any) => Promise<void>

const ADMIN = { admin: true, user: 'admin-1' }
const ISSUE_ID = '6f1c2a5e-0000-4000-8000-000000000001'

const ISSUE = {
    id: ISSUE_ID,
    subject: 'Live-Betreff',
    preheader: null,
    blocks: [{ sort: 1, collection: 'newsletter_blocks_text', item: { heading: 'Text', body: '<p>Hallo</p>' } }],
}

class ForbiddenError extends Error {
    code = 'FORBIDDEN'
}

function setup(options: { versions?: Record<string, any>; readError?: Error } = {}) {
    const readOne = jest.fn(async (id: string, query: any) => {
        if (options.readError) throw options.readError
        if (id !== ISSUE_ID) throw new ForbiddenError("You don't have permission to access this.")
        if (query.version) {
            const versioned = options.versions?.[query.version]
            if (!versioned) throw new ForbiddenError("You don't have permission to access this.")
            return versioned
        }
        return ISSUE
    })
    const serviceOptions: any[] = []
    const ItemsService = jest.fn().mockImplementation((collection: any, opts: any) => {
        serviceOptions.push({ collection, opts })
        return { readOne }
    })
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const routes = new Map<string, RouteHandler>()
    const router = { get: (path: string, handler: RouteHandler) => routes.set(path, handler) }

    registerEndpoint(router as any, { logger, services: { ItemsService }, getSchema: async () => ({}) } as any)

    async function call(params: { id?: string; query?: Record<string, unknown>; accountability?: any } = {}) {
        const handler = routes.get('/:id')
        if (!handler) throw new Error('route not registered')
        const headers: Record<string, string> = {}
        const res: any = {
            statusCode: 0,
            body: undefined as unknown,
            status(code: number) {
                this.statusCode = code
                return this
            },
            set(name: string, value: string) {
                headers[name.toLowerCase()] = value
                return this
            },
            send(body: unknown) {
                this.body = body
                return this
            },
        }
        await handler(
            {
                params: { id: params.id ?? ISSUE_ID },
                query: params.query ?? {},
                accountability: 'accountability' in params ? params.accountability : ADMIN,
            },
            res
        )
        return { status: res.statusCode, body: res.body as string, headers }
    }

    return { call, readOne, serviceOptions, logger }
}

beforeEach(() => {
    jest.clearAllMocks()
    getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
})

describe('checkAdminAccess', () => {
    test('lets admins through', () => {
        expect(checkAdminAccess({ admin: true, user: 'u' })).toBeNull()
    })

    test('401 without a user', () => {
        expect(checkAdminAccess(null)?.status).toBe(401)
        expect(checkAdminAccess(undefined)?.status).toBe(401)
        expect(checkAdminAccess({ admin: false, user: null })?.status).toBe(401)
    })

    test('403 for authenticated non-admins', () => {
        expect(checkAdminAccess({ admin: false, user: 'editor-1' })?.status).toBe(403)
        expect(checkAdminAccess({ user: 'editor-1' })?.status).toBe(403)
    })
})

describe('GET /newsletter-preview/:id', () => {
    test('renders the live issue as HTML for admins', async () => {
        const { call, readOne, serviceOptions } = setup()
        const result = await call()

        expect(result.status).toBe(200)
        expect(result.headers['content-type']).toBe('text/html; charset=utf-8')
        expect(result.headers['cache-control']).toBe('no-store')
        expect(result.body).toContain('<title>Live-Betreff</title>')
        expect(result.body).toContain('<p>Hallo</p>')
        expect(readOne.mock.calls[0]?.[1]).not.toHaveProperty('version')
        // Reads run with the requesting admin's accountability, not a blanket admin context.
        expect(serviceOptions[0]).toEqual({
            collection: 'newsletter_issues',
            opts: expect.objectContaining({ accountability: ADMIN }),
        })
    })

    test.each(['', 'main'])('treats version=%j as the live item', async (version) => {
        const { call, readOne } = setup()
        const result = await call({ query: { version } })

        expect(result.status).toBe(200)
        expect(readOne.mock.calls[0]?.[1]).not.toHaveProperty('version')
    })

    test('renders a Content Version when one is given', async () => {
        const { call, readOne } = setup({ versions: { entwurf: { ...ISSUE, subject: 'Versions-Betreff' } } })
        const result = await call({ query: { version: 'entwurf' } })

        expect(result.status).toBe(200)
        expect(readOne.mock.calls[0]?.[1]).toHaveProperty('version', 'entwurf')
        expect(result.body).toContain('<title>Versions-Betreff</title>')
    })

    test('401 for unauthenticated requests, without reading anything', async () => {
        const { call, readOne } = setup()
        const result = await call({ accountability: null })

        expect(result.status).toBe(401)
        expect(readOne).not.toHaveBeenCalled()
    })

    test('403 for non-admins, without reading anything', async () => {
        const { call, readOne } = setup()
        const result = await call({ accountability: { admin: false, user: 'editor-1' } })

        expect(result.status).toBe(403)
        expect(readOne).not.toHaveBeenCalled()
    })

    test('404 for an unknown issue', async () => {
        const { call } = setup()
        const result = await call({ id: 'does-not-exist' })

        expect(result.status).toBe(404)
        expect(result.headers['content-type']).toBe('text/plain; charset=utf-8')
    })

    test('404 for an unknown version', async () => {
        const { call } = setup()
        const result = await call({ query: { version: 'gibt-es-nicht' } })

        expect(result.status).toBe(404)
        expect(result.body).toContain('gibt-es-nicht')
    })

    test('500 and an error log when website_url is not configured', async () => {
        getRequiredSettingMock.mockRejectedValue(new Error("Required setting 'website_url' is not configured"))
        const { call, logger } = setup()
        const result = await call()

        expect(result.status).toBe(500)
        expect(result.body).toContain('website_url')
        expect(logger.error).toHaveBeenCalled()
    })

    test('500 for unexpected read errors', async () => {
        const { call, logger } = setup({ readError: new Error('database down') })
        const result = await call()

        expect(result.status).toBe(500)
        expect(logger.error).toHaveBeenCalled()
    })

    test('shows a notice above the mail listing hidden unpublished entries', async () => {
        const { call, readOne } = setup()
        readOne.mockResolvedValueOnce({
            ...ISSUE,
            blocks: [
                ...ISSUE.blocks,
                {
                    sort: 2,
                    collection: 'newsletter_blocks_podcasts',
                    item: {
                        heading: 'Folgen',
                        podcasts: [
                            {
                                sort: 1,
                                podcasts_id: {
                                    status: 'published',
                                    slug: 'a',
                                    type: 'news',
                                    number: '1',
                                    title: 'Live',
                                },
                            },
                            {
                                sort: 2,
                                podcasts_id: {
                                    status: 'draft',
                                    slug: 'b',
                                    type: 'news',
                                    number: '2',
                                    title: '<Entwurf>',
                                },
                            },
                        ],
                    },
                },
            ],
        })
        const result = await call()

        expect(result.status).toBe(200)
        expect(result.body).toMatch(/<body[^>]*><div data-preview-notice/)
        expect(result.body).toContain('1 Eintrag ausgeblendet, weil nicht veröffentlicht:')
        expect(result.body).toContain('<li>Podcast: News 2: &lt;Entwurf&gt; (draft)</li>')
        // The hidden episode itself is not in the mail part.
        expect(result.body).not.toContain('/podcast/b')
    })

    test('shows no notice when nothing was hidden', async () => {
        const { call } = setup()
        const result = await call()

        expect(result.status).toBe(200)
        expect(result.body).not.toContain('data-preview-notice')
        expect(result.body).not.toContain('ausgeblendet')
    })

    test('logs renderer warnings', async () => {
        const { call, logger, readOne } = setup()
        readOne.mockResolvedValueOnce({ ...ISSUE, blocks: [{ sort: 1, collection: 'newsletter_blocks_x', item: {} }] })
        const result = await call()

        expect(result.status).toBe(200)
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Unbekannter Blocktyp 'newsletter_blocks_x'"))
        expect(result.body).toContain('Weitere Hinweise:')
    })
})

describe('preview notice', () => {
    test('is empty when nothing was hidden or warned about', () => {
        expect(buildPreviewNotice({ hidden: [], warnings: [] })).toBe('')
        expect(injectPreviewNotice('<body><p>x</p></body>', '')).toBe('<body><p>x</p></body>')
    })

    test('counts and escapes hidden entries', () => {
        const notice = buildPreviewNotice({
            warnings: [],
            hidden: [
                { collection: 'podcasts', title: 'A & B', status: 'draft', reason: 'unpublished' },
                { collection: 'meetups', title: '', status: null, reason: 'unpublished' },
            ],
        })
        expect(notice).toContain('2 Einträge ausgeblendet, weil nicht veröffentlicht:')
        expect(notice).toContain('<li>Podcast: A &amp; B (draft)</li>')
        expect(notice).toContain('<li>Meetup: (ohne Titel) (ohne Status)</li>')
    })

    test('is injected right after the opening body tag', () => {
        expect(injectPreviewNotice('<html><body class="x"><p>Mail</p></body></html>', '<div>N</div>')).toBe(
            '<html><body class="x"><div>N</div><p>Mail</p></body></html>'
        )
        expect(injectPreviewNotice('<p>Mail</p>', '<div>N</div>')).toBe('<div>N</div><p>Mail</p>')
    })
})
