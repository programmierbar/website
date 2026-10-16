import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerEndpoint from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode, so stub it.
// The real `defineEndpoint` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineEndpoint: (callback: unknown) => callback,
}))
jest.mock('../../shared/postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))

const slackMock = jest.mocked(postSlackMessage)

const SECRET = 'a3f1c9d2e8b74f60a3f1c9d2e8b74f60'
const AUTH = `Basic ${Buffer.from(`brevo:${SECRET}`).toString('base64')}`
const SEND_ID = '6f1c2a5e-0000-4000-8000-0000000000aa'
const NEWSLETTER = { 'X-Mailin-custom': `newsletter:send:${SEND_ID}`, tags: ['newsletter'] }

type Row = Record<string, any>

/** Evaluates the subset of Directus filters the store uses. */
function matches(row: Row, filter: Record<string, any>): boolean {
    return Object.entries(filter).every(([field, condition]) => {
        const value = row[field]
        if ('_eq' in condition) return value === condition._eq
        if ('_in' in condition) return condition._in.includes(value)
        if ('_null' in condition) return (value === null || value === undefined) === condition._null
        throw new Error(`unsupported filter ${JSON.stringify(condition)}`)
    })
}

interface SetupOptions {
    secret?: string | undefined
    subscribers?: Row[]
    sends?: Row[]
    failWrites?: boolean
}

function setup(options: SetupOptions = {}) {
    const tables: Record<string, Row[]> = {
        newsletter_subscribers: options.subscribers ?? [],
        newsletter_sends: options.sends ?? [],
    }
    const writes: Array<{ collection: string; method: string; query: any; data: any; accountability: any }> = []

    class FakeItemsService {
        constructor(
            private collection: string,
            private opts: any
        ) {}
        async updateByQuery(query: any, data: any) {
            writes.push({
                collection: this.collection,
                method: 'updateByQuery',
                query,
                data,
                accountability: this.opts?.accountability,
            })
            if (options.failWrites) throw new Error('database down')
            const rows = (tables[this.collection] ?? []).filter((row) => matches(row, query.filter))
            for (const row of rows) Object.assign(row, data)
            return rows.map((row) => row.id)
        }
        async updateMany() {
            throw new Error('updateMany must not be used')
        }
    }

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    let handler: ((req: any, res: any) => Promise<void>) | undefined
    const router = {
        post: (path: string, fn: any) => {
            if (path === '/') handler = fn
        },
    }

    registerEndpoint(
        router as any,
        {
            logger,
            services: { ItemsService: FakeItemsService },
            getSchema: async () => ({}),
            env: 'secret' in options ? { BREVO_WEBHOOK_SECRET: options.secret } : { BREVO_WEBHOOK_SECRET: SECRET },
        } as any
    )

    async function call(body: unknown, authorization: string | null = AUTH) {
        if (!handler) throw new Error('route not registered')
        const res: any = {
            statusCode: 0,
            body: undefined as any,
            status(code: number) {
                this.statusCode = code
                return this
            },
            send(payload: any) {
                this.body = payload
                return this
            },
        }
        await handler({ headers: authorization === null ? {} : { authorization }, body }, res)
        return { status: res.statusCode, body: res.body }
    }

    return { call, tables, writes, logger }
}

const subscriber = (status: string, email = 'leser@example.de') => ({ id: `sub-${status}`, email, status })

beforeEach(() => {
    slackMock.mockReset()
    slackMock.mockResolvedValue()
})

describe('POST /brevo-webhook: authentication', () => {
    test('rejects a request without valid Basic credentials and writes nothing', async () => {
        const { call, writes } = setup({ subscribers: [subscriber('confirmed')] })
        const body = { event: 'hard_bounce', email: 'leser@example.de' }

        expect((await call(body, null)).status).toBe(401)
        expect((await call(body, `Basic ${Buffer.from('brevo:wrong').toString('base64')}`)).status).toBe(401)
        expect((await call(body, `Bearer ${SECRET}`)).status).toBe(401)
        expect(writes).toEqual([])
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('fails closed with 503 and one Slack warning when the secret is not configured', async () => {
        const { call, writes } = setup({ secret: undefined, subscribers: [subscriber('confirmed')] })

        expect((await call({ event: 'hard_bounce', email: 'leser@example.de' })).status).toBe(503)
        expect((await call({ event: 'hard_bounce', email: 'leser@example.de' })).status).toBe(503)
        expect(writes).toEqual([])
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toContain('BREVO_WEBHOOK_SECRET')
    })
})

describe('POST /brevo-webhook: subscribers', () => {
    test.each(['confirmed', 'pending'])('a hard bounce moves a %s subscriber to bounced', async (status) => {
        const { call, tables, writes } = setup({ subscribers: [subscriber(status)] })

        const result = await call({ event: 'hard_bounce', email: 'Leser@Example.de', reason: 'user unknown' })

        expect(result).toEqual({ status: 200, body: { received: 1, transitioned: 1, notedSends: 0 } })
        expect(tables.newsletter_subscribers![0]!.status).toBe('bounced')
        // One conditional system write; date_updated is left to Directus.
        expect(writes).toEqual([
            {
                collection: 'newsletter_subscribers',
                method: 'updateByQuery',
                query: { filter: { email: { _eq: 'leser@example.de' }, status: { _in: ['pending', 'confirmed'] } } },
                data: { status: 'bounced' },
                accountability: null,
            },
        ])
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('a hard bounce of a ticket mail still bounces the subscriber (the address is dead)', async () => {
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })
        await call({ event: 'hard_bounce', email: 'leser@example.de', tags: ['ticket'] })
        expect(tables.newsletter_subscribers![0]!.status).toBe('bounced')
    })

    test.each(['unsubscribed', 'bounced', 'complained'])('never overwrites a %s subscriber', async (status) => {
        const { call, tables } = setup({ subscribers: [subscriber(status)] })

        for (const event of ['hard_bounce', 'spam', 'unsubscribed']) {
            const result = await call({ event, email: 'leser@example.de', ...NEWSLETTER })
            expect(result.status).toBe(200)
        }
        expect(tables.newsletter_subscribers![0]!.status).toBe(status)
    })

    test('a repeated event is a no-op', async () => {
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })
        await call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER })
        const second = await call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER })

        expect(second.body).toMatchObject({ transitioned: 0 })
        expect(tables.newsletter_subscribers![0]!.status).toBe('complained')
        expect(slackMock).toHaveBeenCalledTimes(1)
    })

    test('an unknown address answers 200 so Brevo does not retry', async () => {
        const { call } = setup({ subscribers: [subscriber('confirmed')] })
        const result = await call({ event: 'hard_bounce', email: 'fremd@example.de' })
        expect(result).toEqual({ status: 200, body: { received: 1, transitioned: 0, notedSends: 0 } })
    })

    test('a spam complaint on a newsletter mail → complained, with a Slack message', async () => {
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })

        await call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER })

        expect(tables.newsletter_subscribers![0]!.status).toBe('complained')
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toContain('leser@example.de')
    })

    test('a spam complaint on a double opt-in mail → complained', async () => {
        const { call, tables } = setup({ subscribers: [subscriber('pending')] })
        await call({ event: 'spam', email: 'leser@example.de', 'X-Mailin-custom': 'newsletter:double-opt-in' })
        expect(tables.newsletter_subscribers![0]!.status).toBe('complained')
    })

    test('a spam complaint on any other mail leaves the subscriber alone', async () => {
        const { call, tables, writes } = setup({ subscribers: [subscriber('confirmed')] })

        const result = await call({ event: 'spam', email: 'leser@example.de', tags: ['ticket'] })

        expect(result.body).toMatchObject({ transitioned: 0 })
        expect(tables.newsletter_subscribers![0]!.status).toBe('confirmed')
        expect(writes).toEqual([])
        expect(slackMock).not.toHaveBeenCalled()
    })

    test("Brevo's unsubscribe on a newsletter mail opts out like the website does", async () => {
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })

        await call({ event: 'unsubscribed', email: 'leser@example.de', tag: '["newsletter"]' })

        const row = tables.newsletter_subscribers![0]!
        expect(row.status).toBe('unsubscribed')
        expect(new Date(row.unsubscribed_at).getTime()).not.toBeNaN()
    })

    test('soft bounces and other events change nothing', async () => {
        const { call, writes } = setup({ subscribers: [subscriber('confirmed')] })
        for (const event of ['soft_bounce', 'deferred', 'delivered', 'opened']) {
            expect((await call({ event, email: 'leser@example.de', ...NEWSLETTER })).status).toBe(200)
        }
        expect(writes).toEqual([])
    })

    test('handles a batched array of events', async () => {
        const { call, tables } = setup({
            subscribers: [
                { id: 'a', email: 'a@example.de', status: 'confirmed' },
                { id: 'b', email: 'b@example.de', status: 'confirmed' },
                { id: 'c', email: 'c@example.de', status: 'confirmed' },
            ],
        })

        const result = await call([
            { event: 'hard_bounce', email: 'a@example.de' },
            { event: 'soft_bounce', email: 'b@example.de' },
            { event: 'spam', email: 'c@example.de', tags: ['newsletter'] },
        ])

        expect(result.body).toEqual({ received: 3, transitioned: 2, notedSends: 0 })
        expect(tables.newsletter_subscribers!.map((row) => row.status)).toEqual(['bounced', 'confirmed', 'complained'])
    })
})

describe('POST /brevo-webhook: send rows', () => {
    test('notes the event on the sent row the mail came from; the row stays sent', async () => {
        const { call, tables } = setup({
            subscribers: [subscriber('confirmed')],
            sends: [{ id: SEND_ID, status: 'sent', error: null }],
        })

        const result = await call({
            event: 'hard_bounce',
            email: 'leser@example.de',
            reason: 'mailbox full',
            ...NEWSLETTER,
        })

        expect(result.body).toEqual({ received: 1, transitioned: 1, notedSends: 1 })
        expect(tables.newsletter_sends![0]).toEqual({
            id: SEND_ID,
            status: 'sent',
            error: 'Brevo: hard_bounce (mailbox full)',
        })
    })

    test('a blocked mail is noted, the subscriber stays confirmed', async () => {
        const { call, tables } = setup({
            subscribers: [subscriber('confirmed')],
            sends: [{ id: SEND_ID, status: 'sent', error: null }],
        })

        await call({ event: 'blocked', email: 'leser@example.de', ...NEWSLETTER })

        expect(tables.newsletter_sends![0]!.error).toBe('Brevo: blocked')
        expect(tables.newsletter_subscribers![0]!.status).toBe('confirmed')
    })

    test('keeps the first note and never touches a row that is not sent', async () => {
        const { call, tables } = setup({
            sends: [{ id: SEND_ID, status: 'sent', error: 'Brevo: blocked' }],
        })
        await call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER })
        expect(tables.newsletter_sends![0]!.error).toBe('Brevo: blocked')

        const failed = setup({ sends: [{ id: SEND_ID, status: 'failed', error: null }] })
        await failed.call({ event: 'hard_bounce', email: 'leser@example.de', ...NEWSLETTER })
        expect(failed.tables.newsletter_sends![0]!.error).toBeNull()
    })
})

describe('POST /brevo-webhook: failures', () => {
    test('a database error answers 500 (so Brevo may retry) and reaches Slack once', async () => {
        const { call } = setup({ subscribers: [subscriber('confirmed')], failWrites: true })

        expect((await call({ event: 'hard_bounce', email: 'leser@example.de' })).status).toBe(500)
        expect((await call({ event: 'hard_bounce', email: 'leser@example.de' })).status).toBe(500)
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toContain('database down')
    })

    test('a Slack outage does not fail the request', async () => {
        slackMock.mockRejectedValue(new Error('Slack: down'))
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })

        expect((await call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER })).status).toBe(200)
        expect(tables.newsletter_subscribers![0]!.status).toBe('complained')
    })
})
