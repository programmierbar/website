import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendTemplatedEmail } from '../../shared/email-service.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerEndpoint from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineEndpoint` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineEndpoint: (callback: unknown) => callback,
}))

jest.mock('../../shared/email-service.ts', () => ({
    sendTemplatedEmail: jest.fn(),
    formatDateGerman: (date: string) => `formatted:${date}`,
}))

jest.mock('../../shared/postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))

const sendMock = jest.mocked(sendTemplatedEmail)
const slackMock = jest.mocked(postSlackMessage)

type RouteHandler = (req: any, res: any) => Promise<void>

const ADMIN = { admin: true, user: 'admin-user-1' }
/** The website's static API token belongs to a regular (non-admin) Directus user. */
const WEBSITE = { admin: false, user: 'website-user' }
const NOW = new Date('2026-10-20T12:00:00.000Z')
// Same calendar arithmetic as the speaker-token hook (14 days later, local time).
const EXPIRES = (() => {
    const date = new Date(NOW)
    date.setDate(date.getDate() + 14)
    return date.toISOString()
})()

const SPEAKER = {
    id: 'speaker-1',
    status: 'published',
    slug: 'erika-mustermann',
    email: 'erika@example.com',
    academic_title: null,
    first_name: 'Erika',
    last_name: 'Mustermann',
    occupation: 'CTO bei Beispiel GmbH',
    description: '<p>Erika Mustermann ist CTO.</p>',
    profile_image: 'file-1',
    event_image: 'file-2',
    linkedin_url: 'https://www.linkedin.com/in/erika',
    portal_submission_status: 'submitted',
    portal_token: null,
    portal_token_expires: null,
    portal_update_requested_at: null,
}

interface SetupOptions {
    speaker?: Record<string, any> | null
    /** Existing `profile-update` Content Versions of the speaker. */
    versions?: Array<{ id: string; name: string | null; delta: Record<string, unknown> | null }>
    failVersionDelete?: boolean
    websiteUrl?: string | null
    readers?: string[]
    readError?: Error
}

const forbidden = () => Object.assign(new Error("You don't have permission to access this."), { code: 'FORBIDDEN' })

async function setup(options: SetupOptions = {}) {
    const speaker = options.speaker === null ? null : { ...SPEAKER, ...options.speaker }
    const updates: Array<{ id: any; data: any; opts: any }> = []
    const versionQueries: any[] = []
    const deletedVersions: string[] = []

    class FakeItemsService {
        collection: string
        accountability: any
        constructor(collection: string, opts: any = {}) {
            this.collection = collection
            this.accountability = opts.accountability
        }
        async readOne(id: any) {
            if (options.readError) throw options.readError
            // Directus answers a missing item (and a forbidden one) with a ForbiddenError.
            if (this.collection !== 'speakers' || !speaker || id !== speaker.id) {
                throw forbidden()
            }
            // Stands in for the caller's Directus permissions on `speakers`.
            const readers = options.readers ?? [ADMIN.user, WEBSITE.user]
            if (!this.accountability?.admin && !readers.includes(this.accountability?.user)) {
                throw forbidden()
            }
            return { ...speaker }
        }
        async readByQuery(query: any) {
            if (this.collection === 'automation_settings') {
                const url = options.websiteUrl === undefined ? 'https://www.programmier.bar' : options.websiteUrl
                return query.filter.key._eq === 'website_url' && url !== null ? [{ value: url }] : []
            }
            if (this.collection === 'directus_versions') {
                versionQueries.push(query)
                return (options.versions ?? []).filter((version) => !deletedVersions.includes(version.id))
            }
            return []
        }
        async deleteOne(id: any) {
            if (this.collection !== 'directus_versions') throw new Error(`unexpected delete in ${this.collection}`)
            if (options.failVersionDelete) throw new Error('delete failed')
            deletedVersions.push(id)
            return id
        }
        async updateOne(id: any, data: any, opts: any) {
            updates.push({ id, data, opts })
            if (speaker) Object.assign(speaker, data)
            return id
        }
    }

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const routes = new Map<string, RouteHandler>()
    const router = { post: (path: string, handler: RouteHandler) => routes.set(path, handler) }

    const context = {
        logger,
        services: {
            ItemsService: FakeItemsService,
            MailService: jest.fn(),
        },
        env: { PUBLIC_URL: 'https://admin.example.com/' },
        getSchema: async () => ({ collections: {} }),
    }

    await registerEndpoint(router as any, context as any)

    async function call(body: any = {}, accountability: any = ADMIN, id = 'speaker-1', path = '/:id/request-update') {
        const handler = routes.get(path)
        if (!handler) throw new Error('route not registered')
        const res: any = {
            statusCode: 0,
            body: null,
            status(code: number) {
                this.statusCode = code
                return this
            },
            send(payload: any) {
                this.body = payload
                return this
            },
        }
        await handler({ accountability, params: { id }, body }, res)
        return res
    }

    const report = (body: any, accountability: any = WEBSITE, id = 'speaker-1') =>
        call(body, accountability, id, '/:id/report-update-failure')

    return { call, report, updates, versionQueries, deletedVersions, routes, logger, speaker }
}

beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    sendMock.mockReset().mockResolvedValue(true)
    slackMock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
    jest.useRealTimers()
})

describe('speaker-portal endpoint: POST /:id/request-update', () => {
    test('registers the request-update and report-update-failure routes', async () => {
        const { routes } = await setup()
        expect([...routes.keys()]).toEqual(['/:id/request-update', '/:id/report-update-failure'])
    })

    test('rejects non-admins with 403 and touches nothing', async () => {
        const { call, updates } = await setup()
        for (const accountability of [null, {}, { admin: false, user: 'user-1' }, WEBSITE]) {
            const res = await call({}, accountability)
            expect(res.statusCode).toBe(403)
        }
        expect(updates).toHaveLength(0)
        expect(sendMock).not.toHaveBeenCalled()
    })

    test('sends the mail and stores token, status and request date without emitting events', async () => {
        const { call, updates } = await setup()
        const res = await call()

        expect(res.statusCode).toBe(200)
        expect(res.body).toEqual({ sent: true, requested_at: NOW.toISOString() })

        expect(updates).toHaveLength(1)
        const [write] = updates
        expect(write.id).toBe('speaker-1')
        // No speakers.items.update hook may run for this write: the invitation in
        // speaker-portal-notifications keys off a truthy portal_token in the payload.
        expect(write.opts).toEqual({ emitEvents: false })
        expect(write.data).toEqual({
            portal_token: expect.stringMatching(/^[0-9a-f-]{36}$/),
            portal_token_expires: EXPIRES,
            portal_submission_status: 'update_requested',
            portal_update_requested_at: NOW.toISOString(),
        })

        expect(sendMock).toHaveBeenCalledTimes(1)
        const [options] = sendMock.mock.calls[0]
        expect(options.templateKey).toBe('speaker_profile_update_request')
        expect(options.to).toBe('erika@example.com')
        expect(options.data).toEqual({
            first_name: 'Erika',
            last_name: 'Mustermann',
            profile_overview: expect.stringContaining('CTO bei Beispiel GmbH'),
            public_profile_url: 'https://www.programmier.bar/hall-of-fame/erika-mustermann',
            portal_url: `https://www.programmier.bar/speaker-portal?token=${write.data.portal_token}`,
            expires: `formatted:${EXPIRES}`,
        })
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('leaves out the public profile link for an unpublished speaker', async () => {
        const { call } = await setup({ speaker: { status: 'draft' } })
        await call()
        expect(sendMock.mock.calls[0][0].data.public_profile_url).toBeUndefined()
    })

    test('400 without an email address', async () => {
        const { call, updates } = await setup({ speaker: { email: '  ' } })
        const res = await call()
        expect(res.statusCode).toBe(400)
        expect(res.body.error).toContain('E-Mail-Adresse')
        expect(updates).toHaveLength(0)
    })

    test('404 for an unknown speaker', async () => {
        const { call } = await setup()
        const res = await call({}, ADMIN, 'speaker-unknown')
        expect(res.statusCode).toBe(404)
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('a failing speaker read is a 500 with a Slack alert, not a 404', async () => {
        const { call, logger, updates } = await setup({ readError: new Error('SQLITE_BUSY: database is locked') })
        const res = await call()

        expect(res.statusCode).toBe(500)
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('SQLITE_BUSY'))
        expect(slackMock).toHaveBeenCalled()
        expect(updates).toHaveLength(0)
    })

    describe('cooldown', () => {
        const recent = { portal_update_requested_at: '2026-09-01T08:00:00.000Z' }

        test('refuses a second request within 90 days with a 409 the interface can act on', async () => {
            const { call, updates } = await setup({ speaker: recent })
            const res = await call()

            expect(res.statusCode).toBe(409)
            expect(res.body).toMatchObject({ code: 'cooldown', requested_at: recent.portal_update_requested_at })
            expect(res.body.error).toContain('01.09.2026')
            expect(updates).toHaveLength(0)
            expect(sendMock).not.toHaveBeenCalled()
        })

        test('lets an admin force it', async () => {
            const { call, updates } = await setup({ speaker: recent })
            const res = await call({ force: true })

            expect(res.statusCode).toBe(200)
            expect(updates).toHaveLength(1)
            expect(sendMock).toHaveBeenCalledTimes(1)
        })

        test('only a literal `true` forces', async () => {
            const { call } = await setup({ speaker: recent })
            const res = await call({ force: 'yes' })
            expect(res.statusCode).toBe(409)
        })
    })

    test('refuses while the regular invitation is still open, unless forced', async () => {
        const pending = {
            portal_submission_status: 'pending',
            portal_token: 'open-invitation-token',
            portal_token_expires: '2026-10-28T00:00:00.000Z',
        }
        const { call } = await setup({ speaker: pending })
        const res = await call()
        expect(res.statusCode).toBe(409)
        expect(res.body.code).toBe('invitation_pending')

        const forced = await call({ force: true })
        expect(forced.statusCode).toBe(200)
    })

    describe('missing configuration', () => {
        test('a missing website_url is reported instead of falling back to a default', async () => {
            const { call, updates } = await setup({ websiteUrl: null })
            const res = await call()

            expect(res.statusCode).toBe(500)
            expect(res.body.error).toContain('website_url')
            expect(slackMock).toHaveBeenCalled()
            expect(updates).toHaveLength(0)
        })
    })

    describe('profile-update version', () => {
        const UNREVIEWED = { id: 'v1', name: 'Profil-Update 01.09.2026', delta: { occupation: 'CEO' } }

        test('looks up the speaker’s profile-update versions', async () => {
            const { call, versionQueries } = await setup()
            await call()
            expect(versionQueries[0].filter).toEqual({
                collection: { _eq: 'speakers' },
                item: { _eq: 'speaker-1' },
                key: { _eq: 'profile-update' },
            })
        })

        test('refuses while a version still holds changes, naming it', async () => {
            const { call, updates, deletedVersions } = await setup({ versions: [UNREVIEWED] })
            const res = await call()

            expect(res.statusCode).toBe(409)
            expect(res.body.code).toBe('unreviewed_version')
            expect(res.body.error).toContain('Es gibt noch eine nicht übernommene Version „Profil-Update 01.09.2026“')
            expect(deletedVersions).toHaveLength(0)
            expect(updates).toHaveLength(0)
            expect(sendMock).not.toHaveBeenCalled()
        })

        test('"send anyway" deletes the version before the new token is written', async () => {
            const { call, updates, deletedVersions } = await setup({ versions: [UNREVIEWED] })
            const res = await call({ force: true })

            expect(res.statusCode).toBe(200)
            expect(deletedVersions).toEqual(['v1'])
            expect(updates).toHaveLength(1)
            expect(sendMock).toHaveBeenCalledTimes(1)
        })

        test('an empty version is deleted without asking', async () => {
            const { call, deletedVersions } = await setup({ versions: [{ id: 'v-empty', name: null, delta: null }] })
            const res = await call()

            expect(res.statusCode).toBe(200)
            expect(deletedVersions).toEqual(['v-empty'])
        })

        test('reports every blocker at once, since forcing overrides all of them', async () => {
            const { call } = await setup({
                speaker: { portal_update_requested_at: '2026-09-01T08:00:00.000Z' },
                versions: [UNREVIEWED],
            })
            const res = await call()

            expect(res.statusCode).toBe(409)
            expect(res.body.code).toBe('cooldown')
            expect(res.body.codes).toEqual(['cooldown', 'unreviewed_version'])
            expect(res.body.error).toContain('01.09.2026')
            expect(res.body.error).toContain('nicht übernommene Version')
        })

        test('if the version cannot be deleted, nothing about the speaker changes', async () => {
            const { call, updates } = await setup({ versions: [UNREVIEWED], failVersionDelete: true })
            const res = await call({ force: true })

            expect(res.statusCode).toBe(500)
            expect(updates).toHaveLength(0)
            expect(sendMock).not.toHaveBeenCalled()
            expect(slackMock).toHaveBeenCalled()
        })
    })

    test('a failed send keeps the new token, resets the request date and notifies Slack', async () => {
        sendMock.mockResolvedValue(false)
        const previous = '2026-01-01T00:00:00.000Z'
        const { call, updates, speaker } = await setup({ speaker: { portal_update_requested_at: previous } })
        const res = await call()

        expect(res.statusCode).toBe(502)
        expect(res.body).toMatchObject({ sent: false })
        expect(updates).toHaveLength(2)
        expect(updates[1]).toEqual({
            id: 'speaker-1',
            data: { portal_update_requested_at: previous },
            opts: { emitEvents: false },
        })
        expect(speaker?.portal_submission_status).toBe('update_requested')
        expect(speaker?.portal_token).toEqual(updates[0].data.portal_token)
        expect(slackMock).toHaveBeenCalledWith(expect.stringContaining('konnte nicht versendet werden'))
    })

    test('an unexpected error answers a generic 500 and notifies Slack', async () => {
        const { call, logger } = await setup()
        sendMock.mockRejectedValue(new Error('boom'))
        const res = await call()

        expect(res.statusCode).toBe(500)
        expect(res.body).toEqual({ error: 'Die Profil-Update-Anfrage ist fehlgeschlagen.' })
        expect(logger.error).toHaveBeenCalled()
        expect(slackMock).toHaveBeenCalled()
    })

    test('does not log the speaker email address', async () => {
        const { call, logger } = await setup()
        await call()
        const logged = [...logger.info.mock.calls, ...logger.error.mock.calls].flat().join(' ')
        expect(logged).not.toContain('erika@example.com')
    })
})

describe('speaker-portal endpoint: POST /:id/report-update-failure', () => {
    const OPEN_REQUEST = {
        portal_submission_status: 'update_requested',
        portal_token: 'open-token',
        portal_token_expires: '2026-10-28T10:00:00.000Z',
    }
    const BODY = { stage: 'save_version', message: 'Content Versioning is not enabled for collection "speakers"' }

    test('posts a German Slack message with name, admin link, stage, error and link validity', async () => {
        const { report, updates } = await setup({ speaker: OPEN_REQUEST })
        const res = await report(BODY)

        expect(res.statusCode).toBe(200)
        expect(res.body).toEqual({ notified: true })
        expect(slackMock).toHaveBeenCalledTimes(1)
        const [text] = slackMock.mock.calls[0]
        expect(text).toContain('Erika Mustermann')
        expect(text).toContain('https://admin.example.com/admin/content/speakers/speaker-1')
        expect(text).toContain('„save_version“')
        expect(text).toContain('Content Versioning is not enabled for collection "speakers"')
        expect(text).toContain('Portal-Link ist weiterhin gültig (bis formatted:2026-10-28T10:00:00.000Z)')
        // Reporting never touches the speaker.
        expect(updates).toHaveLength(0)
    })

    test('admins may report too', async () => {
        const { report } = await setup({ speaker: OPEN_REQUEST })
        const res = await report(BODY, ADMIN)
        expect(res.statusCode).toBe(200)
        expect(slackMock).toHaveBeenCalledTimes(1)
    })

    test.each([
        ['no accountability', null],
        ['the public role', { admin: false, user: null, role: null }],
    ])('rejects %s with 401', async (_case, accountability) => {
        const { report } = await setup({ speaker: OPEN_REQUEST })
        const res = await report(BODY, accountability)
        expect(res.statusCode).toBe(401)
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('rejects a user whose own permissions cannot read the speaker', async () => {
        const { report } = await setup({ speaker: OPEN_REQUEST, readers: [] })
        const res = await report(BODY, { admin: false, user: 'editor-without-speakers' })
        expect(res.statusCode).toBe(403)
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('answers an unknown speaker like a forbidden one', async () => {
        const { report } = await setup({ speaker: OPEN_REQUEST })
        const res = await report(BODY, WEBSITE, 'speaker-unknown')
        expect(res.statusCode).toBe(403)
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('a failing speaker read is a 500, not a 403, and posts nothing', async () => {
        const { report, logger } = await setup({ speaker: OPEN_REQUEST, readError: new Error('connection reset') })
        const res = await report(BODY)
        expect(res.statusCode).toBe(500)
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('connection reset'))
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('refuses a speaker without an open update request', async () => {
        const { report } = await setup({ speaker: { portal_submission_status: 'submitted' } })
        const res = await report(BODY)
        expect(res.statusCode).toBe(409)
        expect(res.body.code).toBe('not_update_requested')
        expect(slackMock).not.toHaveBeenCalled()
    })

    test.each([
        [{ message: 'x' }],
        [{ stage: '', message: 'x' }],
        [{ stage: 'Save Version', message: 'x' }],
        [{ stage: 'a'.repeat(41), message: 'x' }],
        [{ stage: 'save_version' }],
        [{ stage: 'save_version', message: { nested: true } }],
    ])('400 for an invalid body %o', async (body) => {
        const { report } = await setup({ speaker: OPEN_REQUEST })
        const res = await report(body)
        expect(res.statusCode).toBe(400)
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('sanitises the message before it reaches Slack', async () => {
        const { report } = await setup({ speaker: OPEN_REQUEST })
        await report({
            stage: 'save_version',
            message: `<!channel> failed for erika@example.com\n<https://evil.example|klick> & ${'x'.repeat(400)}`,
        })

        const [text] = slackMock.mock.calls[0]
        expect(text).not.toContain('erika@example.com')
        expect(text).toContain('[E-Mail]')
        expect(text).not.toContain('<!channel>')
        expect(text).toContain('&lt;!channel&gt;')
        expect(text).not.toContain('<https://evil.example')
        expect(text).not.toContain('\n')
        expect(text).not.toMatch(/x{300}/)
    })

    test('posts the same speaker and stage once per 10 minutes', async () => {
        const { report } = await setup({ speaker: OPEN_REQUEST })

        expect((await report(BODY)).body).toEqual({ notified: true })
        expect((await report(BODY)).body).toEqual({ notified: false, reason: 'duplicate' })
        // A different stage is a different problem.
        expect((await report({ ...BODY, stage: 'other_stage' })).body).toEqual({ notified: true })
        expect(slackMock).toHaveBeenCalledTimes(2)

        jest.setSystemTime(new Date(NOW.getTime() + 10 * 60 * 1000))
        expect((await report(BODY)).body).toEqual({ notified: true })
        expect(slackMock).toHaveBeenCalledTimes(3)
    })

    test('a failed Slack post is answered with 502 and does not block the next report', async () => {
        const { report, logger } = await setup({ speaker: OPEN_REQUEST })
        slackMock.mockRejectedValueOnce(new Error('Slack: channel_not_found'))

        const failed = await report(BODY)
        expect(failed.statusCode).toBe(502)
        expect(logger.error).toHaveBeenCalled()

        const retried = await report(BODY)
        expect(retried.body).toEqual({ notified: true })
    })

    test('says so when the portal link has meanwhile expired', async () => {
        const { report } = await setup({
            speaker: { ...OPEN_REQUEST, portal_token_expires: '2026-10-01T00:00:00.000Z' },
        })
        await report(BODY)
        expect(slackMock.mock.calls[0][0]).toContain('Portal-Link ist inzwischen abgelaufen')
    })
})
