import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { getEmailTemplate, sendTemplatedEmail } from '../../shared/email-service.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerEndpoint from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineEndpoint` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineEndpoint: (callback: unknown) => callback,
}))

jest.mock('../../shared/email-service.ts', () => ({
    sendTemplatedEmail: jest.fn(),
    getEmailTemplate: jest.fn(),
    formatDateGerman: (date: string) => `formatted:${date}`,
}))

jest.mock('../../shared/postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))

const sendMock = jest.mocked(sendTemplatedEmail)
const templateMock = jest.mocked(getEmailTemplate)
const slackMock = jest.mocked(postSlackMessage)

type RouteHandler = (req: any, res: any) => Promise<void>

const ADMIN = { admin: true, user: 'admin-user-1' }
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
    versioning?: boolean
    choices?: string[]
    hasRequestedAtField?: boolean
    hasTemplate?: boolean
    websiteUrl?: string | null
}

async function setup(options: SetupOptions = {}) {
    const speaker = options.speaker === null ? null : { ...SPEAKER, ...options.speaker }
    const updates: Array<{ id: any; data: any; opts: any }> = []

    class FakeItemsService {
        collection: string
        constructor(collection: string) {
            this.collection = collection
        }
        async readOne(id: any) {
            if (this.collection !== 'speakers' || !speaker || id !== speaker.id) {
                throw new Error('not found')
            }
            return { ...speaker }
        }
        async readByQuery(query: any) {
            if (this.collection === 'automation_settings') {
                const url = options.websiteUrl === undefined ? 'https://www.programmier.bar' : options.websiteUrl
                return query.filter.key._eq === 'website_url' && url !== null ? [{ value: url }] : []
            }
            return []
        }
        async updateOne(id: any, data: any, opts: any) {
            updates.push({ id, data, opts })
            if (speaker) Object.assign(speaker, data)
            return id
        }
    }

    class FakeCollectionsService {
        async readOne(collection: string) {
            return { collection, meta: { versioning: options.versioning ?? true } }
        }
    }

    class FakeFieldsService {
        async readOne(_collection: string, field: string) {
            const choices = options.choices ?? ['pending', 'update_requested', 'submitted', 'approved']
            return { field, meta: { options: { choices: choices.map((value) => ({ text: value, value })) } } }
        }
    }

    templateMock.mockResolvedValue(
        options.hasTemplate === false ? null : { subject: 'Profil prüfen', body_html: '{{{profile_overview}}}' }
    )

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const routes = new Map<string, RouteHandler>()
    const router = { post: (path: string, handler: RouteHandler) => routes.set(path, handler) }

    const context = {
        logger,
        services: {
            ItemsService: FakeItemsService,
            CollectionsService: FakeCollectionsService,
            FieldsService: FakeFieldsService,
            MailService: jest.fn(),
        },
        env: { PUBLIC_URL: 'https://admin.example.com/' },
        getSchema: async () => ({
            collections: {
                speakers: {
                    fields:
                        options.hasRequestedAtField === false
                            ? {}
                            : { portal_update_requested_at: { field: 'portal_update_requested_at' } },
                },
            },
        }),
    }

    await registerEndpoint(router as any, context as any)

    async function call(body: any = {}, accountability: any = ADMIN, id = 'speaker-1') {
        const handler = routes.get('/:id/request-update')
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

    return { call, updates, routes, logger, speaker }
}

beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    sendMock.mockReset().mockResolvedValue(true)
    templateMock.mockReset()
    slackMock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
    jest.useRealTimers()
})

describe('speaker-portal endpoint: POST /:id/request-update', () => {
    test('registers only the request-update route', async () => {
        const { routes } = await setup()
        expect([...routes.keys()]).toEqual(['/:id/request-update'])
    })

    test('rejects non-admins with 403 and touches nothing', async () => {
        const { call, updates } = await setup()
        for (const accountability of [null, {}, { admin: false, user: 'user-1' }]) {
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

    describe('missing Directus setup', () => {
        test.each([
            [{ versioning: false }, 'Content Versioning'],
            [{ choices: ['pending', 'submitted', 'approved'] }, 'update_requested'],
            [{ hasRequestedAtField: false }, 'portal_update_requested_at'],
            [{ hasTemplate: false }, 'speaker_profile_update_request'],
        ])('%o → explicit 500 and a Slack notice, nothing written or sent', async (options, expected) => {
            const { call, updates } = await setup(options)
            const res = await call()

            expect(res.statusCode).toBe(500)
            expect(res.body.error).toContain(expected)
            expect(slackMock).toHaveBeenCalledWith(expect.stringContaining(expected))
            expect(updates).toHaveLength(0)
            expect(sendMock).not.toHaveBeenCalled()
        })

        test('a missing website_url is reported instead of falling back to a default', async () => {
            const { call, updates } = await setup({ websiteUrl: null })
            const res = await call()

            expect(res.statusCode).toBe(500)
            expect(res.body.error).toContain('website_url')
            expect(slackMock).toHaveBeenCalled()
            expect(updates).toHaveLength(0)
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
