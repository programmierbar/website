import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getRequiredSetting } from '../../shared/settings.ts'
import registerEndpoint from '../index.ts'

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

const ISSUE_ID = '6f1c2a5e-0000-4000-8000-000000000001'
const ADMIN = { admin: true, user: 'admin-1' }
const REAL_TOKEN = '11111111-2222-4333-8444-555555555555'
const TEST_TOKEN = '00000000-0000-0000-0000-000000000000'

class ForbiddenError extends Error {
    code = 'FORBIDDEN'
}

const BASE_ISSUE = {
    id: ISSUE_ID,
    subject: 'Ausgabe Oktober',
    preheader: null,
    blocks: [
        { sort: 1, collection: 'newsletter_blocks_text', item: { heading: 'Hallo', body: '<p>Text</p>' } },
        {
            sort: 2,
            collection: 'newsletter_blocks_podcasts',
            item: {
                heading: 'Folgen',
                podcasts: [
                    {
                        sort: 1,
                        podcasts_id: { status: 'published', slug: 'a', type: 'news', number: '1', title: 'Live' },
                    },
                    {
                        sort: 2,
                        podcasts_id: { status: 'draft', slug: 'b', type: 'news', number: '2', title: 'Entwurf' },
                    },
                ],
            },
        },
    ],
}

interface SetupOptions {
    issue?: any
    userEmail?: string | null
    subscribers?: any[]
    sendFails?: boolean
    /** The requesting user may not read the issue (their policy), admins still can. */
    denyIssueRead?: boolean
    /** Directus silently drops the nested items the user's policy does not cover. */
    nestedRestricted?: boolean
}

function setup(options: SetupOptions = {}) {
    const issue = 'issue' in options ? options.issue : BASE_ISSUE
    const calls = {
        issueQueries: [] as any[],
        userReads: [] as any[],
        subscriberQueries: [] as any[],
        writes: [] as Array<{ collection: string; method: string }>,
        mails: [] as any[],
    }

    class FakeItemsService {
        constructor(
            private collection: string,
            private opts: any
        ) {}
        async readOne(id: string, query: any) {
            if (this.collection === 'newsletter_issues') {
                calls.issueQueries.push({ id, query, accountability: this.opts?.accountability })
                if (!issue || id !== ISSUE_ID) throw new ForbiddenError('forbidden')
                if (options.denyIssueRead && this.opts?.accountability?.admin !== true) {
                    throw new ForbiddenError('forbidden')
                }
                if (options.nestedRestricted && this.opts?.accountability?.admin !== true) {
                    return { ...issue, blocks: [] }
                }
                return issue
            }
            if (this.collection === 'directus_users') {
                calls.userReads.push({ id, query, accountability: this.opts?.accountability })
                return { email: 'userEmail' in options ? options.userEmail : 'Admin@Example.de' }
            }
            throw new Error(`unexpected readOne on ${this.collection}`)
        }
        async readByQuery(query: any) {
            if (this.collection === 'newsletter_subscribers') {
                calls.subscriberQueries.push(query)
                return (options.subscribers ?? []).filter(
                    (row) => row.email === query.filter.email._eq && row.status === query.filter.status._eq
                )
            }
            throw new Error(`unexpected readByQuery on ${this.collection}`)
        }
        async createOne() {
            calls.writes.push({ collection: this.collection, method: 'createOne' })
        }
        async updateOne() {
            calls.writes.push({ collection: this.collection, method: 'updateOne' })
        }
    }

    class FakeMailService {
        async send(mail: any) {
            if (options.sendFails) throw new Error('smtp down')
            calls.mails.push(mail)
        }
    }

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const routes = new Map<string, RouteHandler>()
    const router = { post: (path: string, handler: RouteHandler) => routes.set(path, handler) }

    registerEndpoint(
        router as any,
        {
            logger,
            services: { ItemsService: FakeItemsService, MailService: FakeMailService },
            getSchema: async () => ({}),
        } as any
    )

    async function call(params: { id?: string; accountability?: any; body?: any } = {}) {
        const handler = routes.get('/:id/test')
        if (!handler) throw new Error('route not registered')
        const res: any = {
            statusCode: 0,
            body: undefined as any,
            status(code: number) {
                this.statusCode = code
                return this
            },
            send(body: any) {
                this.body = body
                return this
            },
        }
        await handler(
            {
                params: { id: params.id ?? ISSUE_ID },
                body: params.body ?? {},
                query: {},
                accountability: 'accountability' in params ? params.accountability : ADMIN,
            },
            res
        )
        return { status: res.statusCode, body: res.body }
    }

    return { call, calls, logger }
}

beforeEach(() => {
    jest.clearAllMocks()
    getRequiredSettingMock.mockResolvedValue('https://www.programmier.bar')
})

describe('POST /newsletter-send/:id/test', () => {
    test('401 for unauthenticated requests, nothing read or sent', async () => {
        const { call, calls } = setup()
        const result = await call({ accountability: null })

        expect(result.status).toBe(401)
        expect(calls.issueQueries).toHaveLength(0)
        expect(calls.mails).toHaveLength(0)
    })

    test('a non-admin can send to their own address, reading the issue with their own rights', async () => {
        const editor = { admin: false, user: 'editor-1' }
        const { call, calls } = setup()
        const result = await call({ accountability: editor, body: { to: 'someone-else@example.de' } })

        expect(result.status).toBe(200)
        expect(calls.issueQueries[0].accountability).toEqual(editor)
        // Their own user record only, read with admin rights (their policy may not cover directus_users).
        expect(calls.userReads).toEqual([
            { id: 'editor-1', query: { fields: ['email'] }, accountability: { admin: true } },
        ])
        expect(calls.mails).toHaveLength(1)
        expect(calls.mails[0].to).toBe('Admin@Example.de')
        expect(JSON.stringify(calls.mails)).not.toContain('someone-else')
    })

    test('mails the complete issue even if the user may not read every nested item', async () => {
        const editor = { admin: false, user: 'editor-1' }
        const { call, calls } = setup({ nestedRestricted: true })
        const result = await call({ accountability: editor })

        expect(result.status).toBe(200)
        // Same content as the real send: access is checked with the user's rights, content read as admin.
        expect(calls.issueQueries[0]).toEqual({ id: ISSUE_ID, query: { fields: ['id'] }, accountability: editor })
        expect(calls.issueQueries[1].accountability).toEqual({ admin: true })
        expect(calls.mails[0].html).toContain('<p>Text</p>')
        expect(calls.mails[0].html).toContain('/podcast/a')
    })

    test('403 without sending when the user may not read the issue', async () => {
        const { call, calls } = setup({ denyIssueRead: true })
        const result = await call({ accountability: { admin: false, user: 'editor-1' } })

        expect(result.status).toBe(403)
        expect(result.body.error).toContain('Keine Berechtigung')
        expect(calls.userReads).toHaveLength(0)
        expect(calls.mails).toHaveLength(0)
    })

    test('401 for an admin token without a user', async () => {
        const { call, calls } = setup()
        const result = await call({ accountability: { admin: true, user: null } })

        expect(result.status).toBe(401)
        expect(calls.mails).toHaveLength(0)
    })

    test('sends the saved issue to the admin’s own address only, with [TEST] subject', async () => {
        const { call, calls } = setup()
        // A recipient smuggled into the body is ignored.
        const result = await call({ body: { to: 'someone-else@example.de' } })

        expect(result.status).toBe(200)
        expect(calls.userReads).toEqual([
            { id: 'admin-1', query: { fields: ['email'] }, accountability: { admin: true } },
        ])
        expect(calls.mails).toHaveLength(1)
        const mail = calls.mails[0]
        expect(mail.to).toBe('Admin@Example.de')
        expect(mail.subject).toBe('[TEST] Ausgabe Oktober')
        expect(mail.html).toContain('<p>Text</p>')
        expect(JSON.stringify(calls.mails)).not.toContain('someone-else')
        expect(result.body).toMatchObject({ recipient: 'Admin@Example.de', subject: '[TEST] Ausgabe Oktober' })
    })

    test('reads the live item, never a Content Version', async () => {
        const { call, calls } = setup()
        await call()

        expect(calls.issueQueries).toHaveLength(2)
        for (const read of calls.issueQueries) {
            expect(read.query).not.toHaveProperty('version')
        }
        // Access check with the requester's rights, content read as admin like the real send.
        expect(calls.issueQueries[0].accountability).toEqual(ADMIN)
        expect(calls.issueQueries[1].query.fields).toContain('blocks.collection')
    })

    test('passes the List-Unsubscribe headers to the MailService', async () => {
        const { call, calls } = setup()
        await call()

        expect(calls.mails[0].headers).toEqual({
            'List-Unsubscribe': `<https://www.programmier.bar/newsletter/unsubscribe?token=${TEST_TOKEN}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Mailin-custom': 'newsletter:test',
            'X-Mailin-Tag': 'newsletter-test',
        })
    })

    test('uses the real unsubscribe link when the admin is a confirmed subscriber', async () => {
        const { call, calls } = setup({
            subscribers: [{ email: 'admin@example.de', status: 'confirmed', unsubscribe_token: REAL_TOKEN }],
        })
        const result = await call()

        const url = `https://www.programmier.bar/newsletter/unsubscribe?token=${REAL_TOKEN}`
        expect(calls.subscriberQueries[0].filter).toEqual({
            email: { _eq: 'admin@example.de' },
            status: { _eq: 'confirmed' },
        })
        expect(calls.mails[0].headers['List-Unsubscribe']).toBe(`<${url}>`)
        expect(calls.mails[0].html).toContain(`href="${url}"`)
        expect(result.body.unsubscribe).toBe('subscriber')
    })

    test('uses the test link when the admin is not a confirmed subscriber', async () => {
        const { call, calls } = setup({
            subscribers: [{ email: 'admin@example.de', status: 'unsubscribed', unsubscribe_token: REAL_TOKEN }],
        })
        const result = await call()

        expect(calls.mails[0].html).toContain(`token=${TEST_TOKEN}`)
        expect(calls.mails[0].html).not.toContain(REAL_TOKEN)
        expect(result.body.unsubscribe).toBe('test')
    })

    test('returns hidden entries and warnings to the UI, not in the mail', async () => {
        const { call, calls } = setup()
        const result = await call()

        expect(result.body.hidden).toEqual([
            { collection: 'podcasts', title: 'News 2: Entwurf', status: 'draft', reason: 'unpublished' },
        ])
        expect(result.body.warnings).toEqual([])
        expect(calls.mails[0].html).not.toContain('Entwurf')
        expect(calls.mails[0].html).not.toContain('data-preview-notice')
    })

    test('writes nothing: no newsletter_sends row, no issue update', async () => {
        const { call, calls, logger } = setup()
        await call()

        expect(calls.writes).toEqual([])
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`test send of issue ${ISSUE_ID}`))
    })

    test('404 for an unknown or unsaved issue', async () => {
        const { call, calls } = setup()
        const unknown = await call({ id: 'does-not-exist' })
        const unsaved = await call({ id: '+' })

        expect(unknown.status).toBe(404)
        expect(unsaved.status).toBe(404)
        expect(calls.mails).toHaveLength(0)
    })

    test('400 when the admin has no email address', async () => {
        const { call, calls } = setup({ userEmail: null })
        const result = await call()

        expect(result.status).toBe(400)
        expect(result.body.error).toContain('keine E-Mail-Adresse')
        expect(calls.mails).toHaveLength(0)
    })

    test('400 when the issue has no subject', async () => {
        const { call, calls } = setup({ issue: { ...BASE_ISSUE, subject: '  ' } })
        const result = await call()

        expect(result.status).toBe(400)
        expect(calls.mails).toHaveLength(0)
    })

    test('502 when the mail could not be sent', async () => {
        const { call, logger } = setup({ sendFails: true })
        const result = await call()

        expect(result.status).toBe(502)
        expect(logger.error).toHaveBeenCalled()
    })

    test('500 without sending when website_url is missing', async () => {
        getRequiredSettingMock.mockRejectedValue(new Error("Required setting 'website_url' is not configured"))
        const { call, calls } = setup()
        const result = await call()

        expect(result.status).toBe(500)
        expect(calls.mails).toHaveLength(0)
    })
})
