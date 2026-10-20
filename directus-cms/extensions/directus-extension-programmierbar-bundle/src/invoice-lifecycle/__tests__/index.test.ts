import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendRawEmail, sendTemplatedEmail } from '../../shared/email-service.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerEndpoint from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineEndpoint` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineEndpoint: (callback: unknown) => callback,
}))

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../../shared/museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

// The lifecycle endpoint must NEVER mail the customer (no templated mail), only the
// plain accounting copy. Mocking the shared email service lets the tests assert both.
jest.mock('../../shared/email-service.ts', () => ({
    sendTemplatedEmail: jest.fn(),
    sendRawEmail: jest.fn(),
}))
jest.mock('../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

const sendTemplatedEmailMock = jest.mocked(sendTemplatedEmail)
const sendRawEmailMock = jest.mocked(sendRawEmail)
const postSlackMessageMock = jest.mocked(postSlackMessage)

const ACCOUNTING_ENV = { ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test' }

type RouteHandler = (req: any, res: any) => Promise<void>

interface Db {
    ticket_orders: any[]
    conferences: any[]
    ticket_invoices: any[]
    tickets: any[]
}

const ADMIN = { admin: true, user: 'admin-user-1' }

const BASE_ORDER = {
    id: 'order-1',
    order_number: 'ORD-2026-ABC123',
    conference: 'conf-1',
    status: 'paid',
    date_paid: '2026-01-20T09:00:00.000Z',
    invoice_number: 'PB-CON26-001',
    invoice_file: 'file-original',
    purchaser_first_name: 'Erika',
    purchaser_last_name: 'Musterfrau',
    purchaser_email: 'erika@example.de',
    company_name: 'Beispiel GmbH',
    company_vat_id: 'DE123456789',
    billing_address_line1: 'Musterstraße 1',
    billing_address_line2: null,
    billing_city: 'Bad Nauheim',
    billing_postal_code: '61231',
    billing_country: 'Deutschland',
    subtotal_cents: 20000,
    discount_amount_cents: 1000,
    total_cents: 19000,
    total_gross_cents: 22610,
    vat_amount_cents: 3610,
    attendees_json: [
        { firstName: 'Erika', lastName: 'Musterfrau', email: 'erika@example.de' },
        { firstName: 'Max', lastName: 'Mustermann', email: 'max@example.de' },
    ],
    ticket_type: 'early_bird',
    is_internal: false,
}

const CONFERENCE = { id: 'conf-1', title: 'programmier.con 2026', start_on: '2026-03-01', end_on: '2026-03-02' }

const ORIGINAL_SNAPSHOT = {
    order_id: 'order-1',
    order_number: 'ORD-2026-ABC123',
    purchaser_name: 'Erika Musterfrau',
    purchaser_email: 'erika@example.de',
    company_name: 'Alte Firma GmbH', // deliberately different from the order's current data
    company_vat_id: 'DE123456789',
    billing_address_line1: 'Alte Straße 9',
    billing_address_line2: null,
    billing_city: 'Bad Nauheim',
    billing_postal_code: '61231',
    billing_country: 'Deutschland',
    conference_title: 'programmier.con 2026',
    ticket_type: 'early_bird',
    ticket_count: 2,
    unit_price_gross_cents: 11900,
    subtotal_cents: 20000,
    discount_amount_cents: 1000,
    vat_amount_cents: 3610,
    total_gross_cents: 22610,
}

function issuedOriginalRow(overrides: Record<string, any> = {}) {
    return {
        id: 'doc-original',
        order: 'order-1',
        type: 'original',
        invoice_number: 'PB-CON26-001',
        invoice_date: '2026-01-20T09:00:00.000Z',
        invoice_file: 'file-original',
        related_invoice: null,
        snapshot_json: { ...ORIGINAL_SNAPSHOT },
        sent_at: '2026-01-20T09:00:05.000Z',
        date_created: '2026-01-20T09:00:00.000Z',
        ...overrides,
    }
}

async function setup(
    options: { order?: Record<string, any>; invoices?: any[]; conference?: any; env?: Record<string, any> } = {}
) {
    const db: Db = {
        ticket_orders: [{ ...BASE_ORDER, ...options.order }],
        conferences: [options.conference ?? { ...CONFERENCE }],
        ticket_invoices: (options.invoices ?? []).map((row) => ({ ...row })),
        tickets: [],
    }

    let docSeq = 100
    let fileSeq = 0
    const calls = {
        creates: [] as Array<{ collection: string; data: any }>,
        updates: [] as Array<{ collection: string; id: any; data: any }>,
        deletes: [] as Array<{ collection: string; id: any }>,
        uploads: [] as any[],
        /** Bytes of each uploaded file, in upload order. */
        uploadedBytes: [] as Buffer[],
        accountabilities: [] as any[],
    }

    class FakeItemsService {
        collection: keyof Db
        constructor(collection: keyof Db, opts: any) {
            this.collection = collection
            calls.accountabilities.push({ collection, accountability: opts?.accountability })
        }
        async readOne(id: any, _query?: any) {
            const row = db[this.collection].find((r) => r.id === id)
            if (!row) throw new Error(`${String(this.collection)} ${id} not found`)
            return { ...row }
        }
        async readByQuery(query: any) {
            let result = [...db[this.collection]]
            if (query?.filter?.order?._eq) {
                result = result.filter((r) => r.order === query.filter.order._eq)
            }
            if (query?.filter?.invoice_number?._starts_with) {
                const prefix = query.filter.invoice_number._starts_with
                result = result.filter((r) => r.invoice_number?.startsWith(prefix))
            }
            const sortKey: string | undefined = query?.sort?.[0]
            if (sortKey) {
                const desc = sortKey.startsWith('-')
                const key = desc ? sortKey.slice(1) : sortKey
                result.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0))
                if (desc) result.reverse()
            }
            if (query?.limit && query.limit > 0) {
                result = result.slice(0, query.limit)
            }
            return result.map((r) => ({ ...r }))
        }
        async createOne(data: any) {
            const id = `doc-${++docSeq}`
            const row = { id, date_created: `2026-06-01T00:00:${String(docSeq).padStart(2, '0')}.000Z`, ...data }
            db[this.collection].push(row)
            calls.creates.push({ collection: this.collection, data: row })
            return id
        }
        async updateOne(id: any, data: any) {
            calls.updates.push({ collection: this.collection, id, data })
            const row = db[this.collection].find((r) => r.id === id)
            if (row) Object.assign(row, data)
            return id
        }
        async deleteOne(id: any) {
            calls.deletes.push({ collection: this.collection, id })
        }
    }

    class FakeFilesService {
        async uploadOne(stream: any, meta: any) {
            const chunks: Buffer[] = []
            for await (const chunk of stream) chunks.push(Buffer.from(chunk))
            calls.uploadedBytes.push(Buffer.concat(chunks))
            calls.uploads.push(meta)
            return `file-new-${++fileSeq}`
        }
    }

    const MailService = jest.fn()
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const routes = new Map<string, RouteHandler>()
    const router = {
        post: (path: string, handler: RouteHandler) => routes.set(path, handler),
    }

    const context = {
        logger,
        services: { ItemsService: FakeItemsService, FilesService: FakeFilesService, MailService },
        env: options.env ?? {},
        getSchema: async () => ({}),
    }

    await registerEndpoint(router as any, context as any)

    async function call(action: string, accountability: any = ADMIN, orderId = 'order-1') {
        const handler = routes.get(`/:id/${action}`)
        if (!handler) throw new Error(`route ${action} not registered`)
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
        await handler({ accountability, params: { id: orderId } }, res)
        return res
    }

    return { db, calls, routes, call, logger, MailService }
}

beforeEach(() => {
    sendTemplatedEmailMock.mockReset()
    sendRawEmailMock.mockReset()
    sendRawEmailMock.mockResolvedValue(true)
    postSlackMessageMock.mockReset()
})

describe('invoice-lifecycle endpoint', () => {
    test('registers the regenerate, correction and cancellation routes', async () => {
        const { routes } = await setup()
        expect([...routes.keys()].sort()).toEqual(['/:id/cancellation', '/:id/correction', '/:id/regenerate'])
    })

    describe('admin-only enforcement', () => {
        test.each(['regenerate', 'correction', 'cancellation'])('%s rejects non-admins with 403', async (action) => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow()] })

            for (const accountability of [null, {}, { admin: false, user: 'user-1' }]) {
                const res = await call(action, accountability)
                expect(res.statusCode).toBe(403)
                expect(res.body).toEqual({ error: 'Admin access required' })
            }

            expect(calls.creates).toHaveLength(0)
            expect(calls.updates).toHaveLength(0)
            expect(calls.uploads).toHaveLength(0)
        })
    })

    describe('shared validations', () => {
        test('404 for an unknown order', async () => {
            const { call } = await setup()
            const res = await call('regenerate', ADMIN, 'order-unknown')
            expect(res.statusCode).toBe(404)
        })

        test('400 for internal orders', async () => {
            const { call } = await setup({ order: { is_internal: true } })
            const res = await call('correction')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('Internal')
        })

        test('400 when the order has no invoice yet', async () => {
            const { call } = await setup({ order: { invoice_number: null, invoice_file: null } })
            const res = await call('regenerate')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('no invoice')
        })

        test('400 when a legacy order needs backfilling but has no date_paid', async () => {
            const { call, calls } = await setup({ order: { date_paid: null }, invoices: [] })
            const res = await call('correction')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('date_paid')
            // No document row was invented with a made-up issuance date.
            expect(calls.creates).toHaveLength(0)
            expect(calls.uploads).toHaveLength(0)
        })
    })

    describe('regenerate (only BEFORE issuance)', () => {
        test('replaces PDF and snapshot of a never-sent invoice, keeping number and date', async () => {
            const notSent = issuedOriginalRow({ sent_at: null })
            const { db, call, calls } = await setup({ invoices: [notSent] })

            const res = await call('regenerate')

            expect(res.statusCode).toBe(200)
            expect(res.body).toEqual({
                invoice_number: 'PB-CON26-001',
                invoice_file: 'file-new-1',
                document_id: 'doc-original',
                accounting_mail: 'skipped', // no ACCOUNTING_INVOICE_EMAIL in this setup
            })

            // Document row updated in place: new file, refreshed snapshot, same number.
            const doc = db.ticket_invoices.find((r) => r.id === 'doc-original')
            expect(doc.invoice_file).toBe('file-new-1')
            expect(doc.invoice_number).toBe('PB-CON26-001')
            expect(doc.snapshot_json.company_name).toBe('Beispiel GmbH') // current order data
            // Order pointer follows; number unchanged.
            const order = db.ticket_orders[0]
            expect(order.invoice_file).toBe('file-new-1')
            expect(order.invoice_number).toBe('PB-CON26-001')
            // No new document row, nothing deleted, no email.
            expect(calls.creates).toHaveLength(0)
            expect(calls.deletes).toHaveLength(0)
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
        })

        test('is blocked once the invoice has been issued (sent)', async () => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow()] })

            const res = await call('regenerate')

            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('already been issued')
            expect(res.body.error).toContain('Rechnungsberichtigung')
            expect(calls.updates).toHaveLength(0)
            expect(calls.uploads).toHaveLength(0)
        })

        test('is blocked for legacy orders without document rows — they are backfilled as issued', async () => {
            const { db, call, calls } = await setup({ invoices: [] })

            const res = await call('regenerate')

            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('already been issued')
            // Lazy backfill created the original document row, issued at date_paid.
            expect(calls.creates).toHaveLength(1)
            const backfilled = db.ticket_invoices[0]
            expect(backfilled).toMatchObject({
                type: 'original',
                invoice_number: 'PB-CON26-001',
                invoice_file: 'file-original',
                sent_at: '2026-01-20T09:00:00.000Z',
            })
        })

        test('is blocked for unpaid orders', async () => {
            const { call } = await setup({
                order: { status: 'pending' },
                invoices: [issuedOriginalRow({ sent_at: null })],
            })
            const res = await call('regenerate')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('not paid')
        })

        test('refuses to regenerate a correction whose reference cannot be resolved', async () => {
            const original = issuedOriginalRow()
            const brokenCorrection = issuedOriginalRow({
                id: 'doc-correction-1',
                type: 'correction',
                invoice_number: 'PB-CON26-002',
                related_invoice: 'doc-vanished', // dangling reference
                date_created: '2026-02-01T00:00:00.000Z',
                sent_at: null,
            })
            const { call, calls } = await setup({ invoices: [original, brokenCorrection] })

            const res = await call('regenerate')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('reference')
            expect(calls.uploads).toHaveLength(0)
            expect(calls.updates).toHaveLength(0)
        })
    })

    describe('correction / Rechnungsberichtigung (only AFTER issuance)', () => {
        test('creates a new document with the next number, referencing the untouched original', async () => {
            const { db, call, calls } = await setup({ invoices: [issuedOriginalRow()] })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(res.body).toMatchObject({
                invoice_number: 'PB-CON26-002', // next in the same sequential series
                invoice_file: 'file-new-1',
                corrects: 'PB-CON26-001',
            })

            // New row: correction, not yet sent, referencing the original.
            const correction = db.ticket_invoices.find((r) => r.type === 'correction')
            expect(correction).toMatchObject({
                order: 'order-1',
                invoice_number: 'PB-CON26-002',
                invoice_file: 'file-new-1',
                related_invoice: 'doc-original',
                sent_at: null,
            })
            // Snapshot taken from the order's CURRENT billing data.
            expect(correction.snapshot_json.company_name).toBe('Beispiel GmbH')
            // Same service as the original: Leistungsdatum from the conference dates.
            expect(correction.snapshot_json).toMatchObject({
                service_date_start: '2026-03-01',
                service_date_end: '2026-03-02',
            })

            // The original document row stays byte-for-byte untouched.
            const original = db.ticket_invoices.find((r) => r.id === 'doc-original')
            expect(original).toEqual(issuedOriginalRow())
            expect(calls.updates.filter((u) => u.collection === 'ticket_invoices')).toHaveLength(0)
            expect(calls.deletes).toHaveLength(0)

            // Order pointers move to the correction (new authoritative invoice).
            expect(db.ticket_orders[0].invoice_number).toBe('PB-CON26-002')
            expect(db.ticket_orders[0].invoice_file).toBe('file-new-1')

            // The correction PDF is named as a Rechnungsberichtigung.
            expect(calls.uploads[0].filename_download).toBe('Rechnungsberichtigung-PB-CON26-002.pdf')

            // No email is ever sent from this path.
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
        })

        test('mints the number across both collections (legacy orders included)', async () => {
            const { call, db } = await setup({
                order: { invoice_number: 'PB-CON26-005' },
                invoices: [issuedOriginalRow({ invoice_number: 'PB-CON26-005' })],
            })
            // Another order's documents already advanced the series in ticket_invoices.
            db.ticket_invoices.push(
                issuedOriginalRow({ id: 'doc-other', order: 'order-2', invoice_number: 'PB-CON26-007' })
            )

            const res = await call('correction')
            expect(res.statusCode).toBe(200)
            expect(res.body.invoice_number).toBe('PB-CON26-008')
        })

        test('is blocked while the invoice has not been issued yet', async () => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow({ sent_at: null })] })
            const res = await call('correction')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('not been issued')
            expect(calls.creates).toHaveLength(0)
        })

        test('is blocked once the invoice has been cancelled', async () => {
            const original = issuedOriginalRow()
            const storno = issuedOriginalRow({
                id: 'doc-storno',
                type: 'cancellation',
                invoice_number: 'PB-CON26-002',
                related_invoice: 'doc-original',
                date_created: '2026-02-01T00:00:00.000Z',
            })
            const { call, calls } = await setup({ invoices: [original, storno] })

            const res = await call('correction')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('cancelled')
            expect(calls.creates).toHaveLength(0)
        })

        test('corrects the latest correction, not the first original', async () => {
            const original = issuedOriginalRow()
            const firstCorrection = issuedOriginalRow({
                id: 'doc-correction-1',
                type: 'correction',
                invoice_number: 'PB-CON26-002',
                related_invoice: 'doc-original',
                date_created: '2026-02-01T00:00:00.000Z',
                sent_at: '2026-02-01T00:00:05.000Z',
            })
            const { db, call } = await setup({ invoices: [original, firstCorrection] })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(res.body.invoice_number).toBe('PB-CON26-003')
            expect(res.body.corrects).toBe('PB-CON26-002')
            const newest = db.ticket_invoices.find((r) => r.invoice_number === 'PB-CON26-003')
            expect(newest.related_invoice).toBe('doc-correction-1')
        })
    })

    describe('cancellation / Stornorechnung (only AFTER issuance)', () => {
        test('creates a new document mirroring the referenced snapshot negatively', async () => {
            const { db, call, calls } = await setup({ invoices: [issuedOriginalRow()] })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body).toMatchObject({
                invoice_number: 'PB-CON26-002',
                invoice_file: 'file-new-1',
                cancels: 'PB-CON26-001',
            })

            const storno = db.ticket_invoices.find((r) => r.type === 'cancellation')
            expect(storno).toMatchObject({
                order: 'order-1',
                invoice_number: 'PB-CON26-002',
                related_invoice: 'doc-original',
                sent_at: null,
            })
            // Amounts mirror the ISSUED snapshot (old company name!), not current order data.
            expect(storno.snapshot_json).toMatchObject({
                company_name: 'Alte Firma GmbH',
                unit_price_gross_cents: -11900,
                subtotal_cents: -20000,
                discount_amount_cents: -1000,
                vat_amount_cents: -3610,
                total_gross_cents: -22610,
                ticket_count: 2,
                // The referenced snapshot predates the Leistungsdatum: falls back to the conference dates.
                service_date_start: '2026-03-01',
                service_date_end: '2026-03-02',
            })

            // The original document row stays untouched, nothing is deleted.
            expect(db.ticket_invoices.find((r) => r.id === 'doc-original')).toEqual(issuedOriginalRow())
            expect(calls.deletes).toHaveLength(0)

            // Order is left alone entirely: no pointer change, no status change,
            // and tickets are never touched.
            expect(calls.updates.filter((u) => u.collection === 'ticket_orders')).toHaveLength(0)
            expect(db.ticket_orders[0].invoice_number).toBe('PB-CON26-001')
            expect(db.ticket_orders[0].status).toBe('paid')
            expect(calls.creates.filter((c) => c.collection === 'tickets')).toHaveLength(0)
            expect(calls.updates.filter((u) => u.collection === 'tickets')).toHaveLength(0)

            expect(calls.uploads[0].filename_download).toBe('Stornorechnung-PB-CON26-002.pdf')
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
        })

        test('never instantiates the mail service directly (all mail goes through the shared helpers)', async () => {
            const { call, MailService } = await setup({ invoices: [issuedOriginalRow()] })
            await call('cancellation')
            expect(MailService).not.toHaveBeenCalled()
        })

        test('works for orders that are no longer paid (e.g. refunded and cancelled)', async () => {
            const { call } = await setup({
                order: { status: 'cancelled' },
                invoices: [issuedOriginalRow()],
            })
            const res = await call('cancellation')
            expect(res.statusCode).toBe(200)
        })

        test('is blocked while the invoice has not been issued yet', async () => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow({ sent_at: null })] })
            const res = await call('cancellation')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('not been issued')
            expect(calls.creates).toHaveLength(0)
        })

        test.each([
            ['missing', null],
            ['malformed', '{not json'],
        ])(
            'is rejected when the referenced snapshot is %s instead of falling back to order data',
            async (_label, snapshotJson) => {
                const { call, calls, db } = await setup({
                    invoices: [issuedOriginalRow({ snapshot_json: snapshotJson })],
                })

                const res = await call('cancellation')

                expect(res.statusCode).toBe(400)
                expect(res.body.error).toContain('snapshot')
                // No storno was created from the order's current (mutable) values.
                expect(calls.creates).toHaveLength(0)
                expect(calls.uploads).toHaveLength(0)
                expect(db.ticket_invoices).toHaveLength(1)
            }
        )

        test('cannot cancel the same invoice twice', async () => {
            const original = issuedOriginalRow()
            const storno = issuedOriginalRow({
                id: 'doc-storno',
                type: 'cancellation',
                invoice_number: 'PB-CON26-002',
                related_invoice: 'doc-original',
                date_created: '2026-02-01T00:00:00.000Z',
            })
            const { call, calls } = await setup({ invoices: [original, storno] })

            const res = await call('cancellation')
            expect(res.statusCode).toBe(400)
            expect(res.body.error).toContain('already been cancelled')
            expect(calls.creates).toHaveLength(0)
        })
    })

    describe('audit trail', () => {
        test('services run with the requesting admin accountability so Directus records the acting user', async () => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow()] })
            await call('correction')

            const invoiceServiceUses = calls.accountabilities.filter((a) => a.collection === 'ticket_invoices')
            expect(invoiceServiceUses.length).toBeGreaterThan(0)
            for (const use of invoiceServiceUses) {
                expect(use.accountability).toBe(ADMIN)
            }
        })
    })

    describe('accounting copy', () => {
        test('a correction is mailed to accounting with the stored PDF', async () => {
            const { call, calls, db } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('sent')
            expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
            const mail = sendRawEmailMock.mock.calls[0]![0]
            expect(mail.to).toBe('accounting@example.test')
            expect(mail.subject).toBe('Rechnungsberichtigung PB-CON26-002')
            expect(mail.text).toContain('zu Rechnung PB-CON26-001')
            expect(mail.attachments).toHaveLength(1)
            expect(mail.attachments![0]!.filename).toBe('Rechnungsberichtigung-PB-CON26-002.pdf')
            // Same bytes as the stored file.
            expect(mail.attachments![0]!.content.equals(calls.uploadedBytes[0]!)).toBe(true)
            expect(mail.attachments![0]!.content.subarray(0, 4).toString()).toBe('%PDF')

            // The customer is not mailed, and the accounting copy does not issue the document.
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
            expect(db.ticket_invoices.find((r) => r.type === 'correction').sent_at).toBeNull()
        })

        test('a cancellation is mailed to accounting', async () => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('sent')
            expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
            const mail = sendRawEmailMock.mock.calls[0]![0]
            expect(mail.subject).toBe('Stornorechnung PB-CON26-002')
            expect(mail.attachments![0]!.filename).toBe('Stornorechnung-PB-CON26-002.pdf')
            expect(mail.attachments![0]!.content.equals(calls.uploadedBytes[0]!)).toBe(true)
            expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
        })

        test('a pre-issuance regenerate sends the new version, marked as replacing the previous one', async () => {
            const { call, calls } = await setup({
                invoices: [issuedOriginalRow({ sent_at: null })],
                env: ACCOUNTING_ENV,
            })

            const res = await call('regenerate')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('sent')
            const mail = sendRawEmailMock.mock.calls[0]![0]
            expect(mail.subject).toBe('Rechnung PB-CON26-001 (ersetzt vorherige Fassung)')
            expect(mail.attachments![0]!.filename).toBe('Rechnung-PB-CON26-001.pdf')
            expect(mail.attachments![0]!.content.equals(calls.uploadedBytes[0]!)).toBe(true)
        })

        test('a regenerated correction keeps its document type and reference in the accounting mail', async () => {
            const correction = issuedOriginalRow({
                id: 'doc-correction-1',
                type: 'correction',
                invoice_number: 'PB-CON26-002',
                related_invoice: 'doc-original',
                date_created: '2026-02-01T00:00:00.000Z',
                sent_at: null,
            })
            const { call } = await setup({ invoices: [issuedOriginalRow(), correction], env: ACCOUNTING_ENV })

            const res = await call('regenerate')

            expect(res.statusCode).toBe(200)
            const mail = sendRawEmailMock.mock.calls[0]![0]
            expect(mail.subject).toBe('Rechnungsberichtigung PB-CON26-002 (ersetzt vorherige Fassung)')
            expect(mail.text).toContain('zu Rechnung PB-CON26-001')
        })

        test('is skipped with an info log when ACCOUNTING_INVOICE_EMAIL is not set', async () => {
            const { call, logger } = await setup({ invoices: [issuedOriginalRow()] })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('skipped')
            expect(sendRawEmailMock).not.toHaveBeenCalled()
            const infoLog = logger.info.mock.calls.map((c) => String(c[0])).join('\n')
            expect(infoLog).toContain('ACCOUNTING_INVOICE_EMAIL')
            expect(logger.error).not.toHaveBeenCalled()
        })

        test('persistent failure: document is still created, Slack is alerted, endpoint answers 200', async () => {
            sendRawEmailMock.mockResolvedValue(false)
            const { call, db } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('failed')
            expect(sendRawEmailMock).toHaveBeenCalledTimes(3)
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(postSlackMessageMock.mock.calls[0]![0]).toContain('Stornorechnung PB-CON26-002')
            expect(db.ticket_invoices.find((r) => r.type === 'cancellation')).toMatchObject({
                invoice_number: 'PB-CON26-002',
                sent_at: null,
            })
        })

        test('blocked operations and internal orders send nothing', async () => {
            const blocked = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })
            expect((await blocked.call('regenerate')).statusCode).toBe(400)

            const internal = await setup({ order: { is_internal: true }, env: ACCOUNTING_ENV })
            expect((await internal.call('correction')).statusCode).toBe(400)

            expect(sendRawEmailMock).not.toHaveBeenCalled()
        })
    })
})
