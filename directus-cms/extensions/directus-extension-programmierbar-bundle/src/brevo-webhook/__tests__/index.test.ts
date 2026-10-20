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
/** A newsletter mail without a send row (test send / double opt-in style marker). */
const NEWSLETTER_MAIL = { tags: ['newsletter'] }
/** A ticket mail as Brevo reports it: no newsletter marker. */
const TICKET = { subject: 'Deine Tickets für die programmier.con', 'message-id': '<ticket-1@programmier.bar>' }

type Row = Record<string, any>

interface SetupOptions {
    secret?: string | undefined
    subscribers?: Row[]
    sends?: Row[]
    failWrites?: boolean
}

interface Statement {
    table: string
    where: Row
    whereIn: Record<string, unknown[]>
    whereNull: string[]
    data: Row
}

function setup(options: SetupOptions = {}) {
    const tables: Record<string, Row[]> = {
        newsletter_subscribers: options.subscribers ?? [],
        newsletter_sends: options.sends ?? [],
    }
    const writes: Statement[] = []

    /**
     * A knex stand-in for `database(table).where(…).whereIn(…).whereNull(…).update(…)`. The
     * predicate is evaluated inside `update`, like the single SQL statement it stands for.
     */
    function database(table: string) {
        const statement: Statement = { table, where: {}, whereIn: {}, whereNull: [], data: {} }
        const builder = {
            where(conditions: Row) {
                Object.assign(statement.where, conditions)
                return builder
            },
            whereIn(column: string, values: unknown[]) {
                statement.whereIn[column] = values
                return builder
            },
            whereNull(column: string) {
                statement.whereNull.push(column)
                return builder
            },
            async update(data: Row) {
                statement.data = data
                writes.push(statement)
                if (options.failWrites) throw new Error('database down')
                const rows = (tables[table] ?? []).filter(
                    (row) =>
                        Object.entries(statement.where).every(([column, value]) => row[column] === value) &&
                        Object.entries(statement.whereIn).every(([column, values]) => values.includes(row[column])) &&
                        statement.whereNull.every((column) => row[column] === null || row[column] === undefined)
                )
                for (const row of rows) Object.assign(row, data)
                return rows.length
            },
        }
        return builder
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
            services: {},
            getSchema: async () => ({}),
            database,
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

        const result = await call({
            event: 'hard_bounce',
            email: 'Leser@Example.de',
            reason: 'user unknown',
            ...NEWSLETTER_MAIL,
        })

        expect(result).toEqual({ status: 200, body: { received: 1, transitioned: 1, notedSends: 0 } })
        expect(tables.newsletter_subscribers![0]!.status).toBe('bounced')
        // One conditional UPDATE: the status guard is applied by the database in the same statement.
        expect(writes).toEqual([
            {
                table: 'newsletter_subscribers',
                where: { email: 'leser@example.de' },
                whereIn: { status: ['pending', 'confirmed'] },
                whereNull: [],
                data: { status: 'bounced', date_updated: expect.any(String) },
            },
        ])
        // Raw knex bypasses Directus, so date_updated (the time of the bounce) is written here.
        expect(Number.isNaN(new Date(tables.newsletter_subscribers![0]!.date_updated).getTime())).toBe(false)
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
            date_updated: expect.any(String),
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

describe('POST /brevo-webhook: undelivered non-newsletter mails', () => {
    test('a hard bounce of a ticket mail bounces the subscriber and warns on Slack', async () => {
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })

        const result = await call({
            event: 'hard_bounce',
            email: 'leser@example.de',
            reason: 'user unknown',
            ...TICKET,
        })

        expect(result).toEqual({ status: 200, body: { received: 1, transitioned: 1, notedSends: 0 } })
        expect(tables.newsletter_subscribers![0]!.status).toBe('bounced')
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toBe(
            ':warning: *E-Mail*: Brevo hat eine Mail an leser@example.de nicht zugestellt – `hard_bounce` (user unknown). Betreff: „Deine Tickets für die programmier.con“. Falls wichtig (z. B. Bestellbestätigung oder Rechnung), bitte auf anderem Weg nachreichen.'
        )
    })

    test.each(['invalid_email', 'blocked'])('%s on a ticket mail warns, also for non-subscribers', async (event) => {
        const { call, writes } = setup()

        const result = await call({ event, email: 'kaeufer@example.de', ...TICKET })

        expect(result.status).toBe(200)
        expect(slackMock).toHaveBeenCalledTimes(1)
        const text = slackMock.mock.calls[0]![0]
        expect(text).toContain('kaeufer@example.de')
        expect(text).toContain(`\`${event}\``)
        expect(text).toContain('„Deine Tickets für die programmier.con“')
        // blocked never writes; invalid_email only tries the (absent) subscriber.
        expect(writes.filter((w) => w.table === 'newsletter_sends')).toEqual([])
    })

    test('without subject and reason the warning still names address and event', async () => {
        const { call } = setup()
        await call({ event: 'blocked', email: 'kaeufer@example.de' })
        expect(slackMock.mock.calls[0]![0]).toContain(
            'kaeufer@example.de nicht zugestellt – `blocked`. Betreff: (ohne Betreff).'
        )
    })

    test('escapes Slack markup in subject and reason', async () => {
        const { call } = setup()
        await call({ event: 'blocked', email: 'a@example.de', subject: 'Q&A <live>', reason: '<@channel>' })
        const text = slackMock.mock.calls[0]![0]
        expect(text).toContain('„Q&amp;A &lt;live&gt;“')
        expect(text).toContain('(&lt;@channel&gt;)')
        expect(text).not.toContain('<')
    })

    test('no warning for newsletter, test and double opt-in mails', async () => {
        const { call } = setup({ sends: [{ id: SEND_ID, status: 'sent', error: null }] })
        for (const marker of [NEWSLETTER, NEWSLETTER_MAIL, { 'X-Mailin-custom': 'newsletter:double-opt-in' }]) {
            for (const event of ['hard_bounce', 'invalid_email', 'blocked']) {
                await call({ event, email: 'leser@example.de', ...marker })
            }
        }
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('no warning for other events on a ticket mail', async () => {
        const { call } = setup()
        for (const event of ['soft_bounce', 'deferred', 'delivered', 'spam', 'unsubscribed']) {
            await call({ event, email: 'kaeufer@example.de', ...TICKET })
        }
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('a re-delivered event warns once; another mail warns again', async () => {
        const { call } = setup()
        const event = { event: 'blocked', email: 'kaeufer@example.de', ...TICKET }

        await call(event)
        await call(event)
        await call([event, event])
        await call({ ...event, subject: 'Deine Rechnung', 'message-id': '<invoice-1@programmier.bar>' })
        // Without a message id, address and subject identify the mail.
        await call({ event: 'blocked', email: 'kaeufer@example.de', subject: 'Deine Rechnung' })
        await call({ event: 'blocked', email: 'kaeufer@example.de', subject: 'Deine Rechnung' })

        expect(slackMock).toHaveBeenCalledTimes(3)
    })

    test('recipients of the same mail (shared message id, e.g. buyer + billing CC) each warn once', async () => {
        const { call } = setup()
        const buyer = { event: 'hard_bounce', email: 'kaeufer@example.de', ...TICKET }
        const billing = { event: 'hard_bounce', email: 'buchhaltung@example.de', ...TICKET }

        await call(buyer)
        await call(billing)
        await call(buyer)
        await call([billing, buyer])

        expect(slackMock).toHaveBeenCalledTimes(2)
        const texts = slackMock.mock.calls.map((args) => args[0])
        expect(texts[0]).toContain('kaeufer@example.de')
        expect(texts[1]).toContain('buchhaltung@example.de')
    })

    test('a warning Slack did not take is retried when Brevo delivers again', async () => {
        slackMock.mockRejectedValueOnce(new Error('Slack: down'))
        const { call } = setup()
        const event = { event: 'blocked', email: 'kaeufer@example.de', ...TICKET }

        expect((await call(event)).status).toBe(200)
        await call(event)
        await call(event)

        // First post failed, second succeeded, third is suppressed.
        expect(slackMock).toHaveBeenCalledTimes(2)
    })

    test('the warning goes out even if the database write fails', async () => {
        const { call } = setup({ subscribers: [subscriber('confirmed')], failWrites: true })

        const result = await call({ event: 'hard_bounce', email: 'leser@example.de', ...TICKET })

        expect(result.status).toBe(500)
        const texts = slackMock.mock.calls.map((args) => args[0])
        expect(texts).toHaveLength(2)
        expect(texts[0]).toContain('nicht zugestellt')
        expect(texts[1]).toContain('database down')
        // Brevo retries after the 500: neither message repeats.
        await call({ event: 'hard_bounce', email: 'leser@example.de', ...TICKET })
        expect(slackMock).toHaveBeenCalledTimes(2)
    })
})

describe('POST /brevo-webhook: overlapping events', () => {
    test('two events racing for the same subscriber: exactly one transition wins', async () => {
        const { call, tables, writes } = setup({ subscribers: [subscriber('confirmed')] })

        const [bounce, complaint] = await Promise.all([
            call({ event: 'hard_bounce', email: 'leser@example.de', ...NEWSLETTER_MAIL }),
            call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER }),
        ])

        // Both carried the status guard in their UPDATE; only the first one matched.
        expect(writes.filter((w) => w.table === 'newsletter_subscribers')).toHaveLength(2)
        expect(writes.every((w) => w.table !== 'newsletter_subscribers' || w.whereIn.status)).toBe(true)
        expect(bounce.body.transitioned + complaint.body.transitioned).toBe(1)
        expect(tables.newsletter_subscribers![0]!.status).toBe('bounced')
    })

    test('a confirm or unsubscribe that lands first is not overwritten', async () => {
        const { call, tables } = setup({ subscribers: [subscriber('pending')] })
        // The website opts out between Brevo's event and our write: the guard sees it.
        tables.newsletter_subscribers![0]!.status = 'unsubscribed'

        const result = await call({ event: 'hard_bounce', email: 'leser@example.de' })

        expect(result.body).toMatchObject({ transitioned: 0 })
        expect(tables.newsletter_subscribers![0]!.status).toBe('unsubscribed')
    })

    test('two events racing for the same send row: the first note stays', async () => {
        const { call, tables, writes } = setup({ sends: [{ id: SEND_ID, status: 'sent', error: null }] })

        const results = await Promise.all([
            call({ event: 'blocked', email: 'leser@example.de', ...NEWSLETTER }),
            call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER }),
        ])

        const noteWrites = writes.filter((w) => w.table === 'newsletter_sends')
        expect(noteWrites).toHaveLength(2)
        expect(noteWrites.every((w) => w.whereNull.includes('error') && w.where.status === 'sent')).toBe(true)
        expect(results.map((r) => r.body.notedSends).reduce((a, b) => a + b, 0)).toBe(1)
        expect(tables.newsletter_sends![0]!.error).toBe('Brevo: blocked')
    })
})

describe('POST /brevo-webhook: failures', () => {
    test('a database error answers 500 (so Brevo may retry) and reaches Slack once', async () => {
        const { call } = setup({ subscribers: [subscriber('confirmed')], failWrites: true })

        const body = { event: 'hard_bounce', email: 'leser@example.de', ...NEWSLETTER_MAIL }
        expect((await call(body)).status).toBe(500)
        expect((await call(body)).status).toBe(500)
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toContain('database down')
    })

    test('a Slack alert that did not go out is retried with the next request', async () => {
        slackMock.mockRejectedValueOnce(new Error('Slack: down'))
        const { call } = setup({ subscribers: [subscriber('confirmed')], failWrites: true })

        const body = { event: 'hard_bounce', email: 'leser@example.de', ...NEWSLETTER_MAIL }
        await call(body)
        await call(body)
        await call(body)

        // First post failed, second succeeded, third is suppressed.
        expect(slackMock).toHaveBeenCalledTimes(2)
    })

    test('concurrent requests while the first alert is in flight post it only once', async () => {
        let release!: () => void
        slackMock.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
        const { call } = setup({ secret: undefined })

        const first = call({ event: 'hard_bounce', email: 'leser@example.de' })
        await Promise.all([
            call({ event: 'hard_bounce', email: 'leser@example.de' }),
            call({ event: 'hard_bounce', email: 'leser@example.de' }),
        ])
        release()
        await first

        expect(slackMock).toHaveBeenCalledTimes(1)
    })

    test('the missing-secret warning is retried too until Slack accepts it', async () => {
        slackMock.mockRejectedValueOnce(new Error('Slack: down'))
        const { call } = setup({ secret: undefined })

        for (let i = 0; i < 3; i++) await call({ event: 'hard_bounce', email: 'leser@example.de' })

        expect(slackMock).toHaveBeenCalledTimes(2)
    })

    test('a Slack outage does not fail the request', async () => {
        slackMock.mockRejectedValue(new Error('Slack: down'))
        const { call, tables } = setup({ subscribers: [subscriber('confirmed')] })

        expect((await call({ event: 'spam', email: 'leser@example.de', ...NEWSLETTER })).status).toBe(200)
        expect(tables.newsletter_subscribers![0]!.status).toBe('complained')
    })
})
