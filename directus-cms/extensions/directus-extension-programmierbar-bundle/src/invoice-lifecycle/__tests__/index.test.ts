import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { resetAccountingMailState } from '../../shared/accounting-mail.ts'
import { deliverTemplatedEmail, sendRawEmail } from '../../shared/email-service.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerEndpoint from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineEndpoint` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineEndpoint: (callback: unknown) => callback,
}))

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../../shared/museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

// Corrections and cancellations are mailed to the customer through the templated mail
// path (`deliverTemplatedEmail`), the accounting copy as a plain mail (`sendRawEmail`).
// Mocking the shared email service lets the tests assert both and stay offline.
jest.mock('../../shared/email-service.ts', () => ({
    deliverTemplatedEmail: jest.fn(),
    sendRawEmail: jest.fn(),
}))
jest.mock('../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
    isSlackConfigured: jest.fn(() => false),
}))

const deliverTemplatedEmailMock = jest.mocked(deliverTemplatedEmail)
const sendRawEmailMock = jest.mocked(sendRawEmail)
const postSlackMessageMock = jest.mocked(postSlackMessage)

const ACCOUNTING_ENV = { ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test' }

/** The accounting mail handed to the shared email service (n-th call). */
const accountingMail = (n = 0) => sendRawEmailMock.mock.calls[n]![0] as any

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
    deliverTemplatedEmailMock.mockReset()
    deliverTemplatedEmailMock.mockResolvedValue('sent')
    sendRawEmailMock.mockReset()
    sendRawEmailMock.mockResolvedValue(true)
    resetAccountingMailState()
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
            // No new document row, nothing deleted, no customer email, still not issued.
            expect(calls.creates).toHaveLength(0)
            expect(calls.deletes).toHaveLength(0)
            expect(deliverTemplatedEmailMock).not.toHaveBeenCalled()
            expect(doc.sent_at).toBeNull()
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

        test('is refused with 409 while the document is younger than a minute (dispatch may be running)', async () => {
            const createdAt = Date.parse('2026-06-01T12:00:00.000Z')
            const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(createdAt + 59_999)
            try {
                const fresh = issuedOriginalRow({ sent_at: null, date_created: new Date(createdAt).toISOString() })
                const { call, calls } = await setup({ invoices: [fresh] })

                const res = await call('regenerate')

                expect(res.statusCode).toBe(409)
                expect(res.body.error).toContain('gerade erst erstellt')
                expect(calls.uploads).toHaveLength(0)
                expect(calls.updates).toHaveLength(0)
            } finally {
                nowSpy.mockRestore()
            }
        })

        test('is allowed again once the document is a minute old (recovery after a failed mail)', async () => {
            const createdAt = Date.parse('2026-06-01T12:00:00.000Z')
            const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(createdAt + 60_000)
            try {
                const fresh = issuedOriginalRow({ sent_at: null, date_created: new Date(createdAt).toISOString() })
                const { call, calls } = await setup({ invoices: [fresh] })

                const res = await call('regenerate')

                expect(res.statusCode).toBe(200)
                expect(calls.uploads).toHaveLength(1)
            } finally {
                nowSpy.mockRestore()
            }
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

            // New row: correction referencing the original.
            const correction = db.ticket_invoices.find((r) => r.type === 'correction')
            expect(correction).toMatchObject({
                order: 'order-1',
                invoice_number: 'PB-CON26-002',
                invoice_file: 'file-new-1',
                related_invoice: 'doc-original',
            })
            // Snapshot taken from the order's CURRENT billing data.
            expect(correction.snapshot_json.company_name).toBe('Beispiel GmbH')
            // Same service as the original: Leistungsdatum from the conference dates.
            expect(correction.snapshot_json).toMatchObject({
                service_date_start: '2026-03-01',
                service_date_end: '2026-03-02',
            })

            // The original document row stays byte-for-byte untouched; the only document
            // update is the sent_at stamp on the new correction (see "customer mail").
            const original = db.ticket_invoices.find((r) => r.id === 'doc-original')
            expect(original).toEqual(issuedOriginalRow())
            expect(
                calls.updates.filter((u) => u.collection === 'ticket_invoices' && u.id !== correction.id)
            ).toHaveLength(0)
            expect(calls.deletes).toHaveLength(0)

            // Order pointers move to the correction (new authoritative invoice).
            expect(db.ticket_orders[0].invoice_number).toBe('PB-CON26-002')
            expect(db.ticket_orders[0].invoice_file).toBe('file-new-1')

            // The correction PDF is named as a Rechnungsberichtigung.
            expect(calls.uploads[0].filename_download).toBe('Rechnungsberichtigung-PB-CON26-002.pdf')
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

        test('amounts that do not add up to a valid e-invoice: issued as plain PDF, Slack alerted', async () => {
            postSlackMessageMock.mockResolvedValue(undefined)
            // Hand-edited order: net 190 € + VAT 36 € ≠ the stored gross total of 226,10 €.
            const { call, calls } = await setup({
                order: { vat_amount_cents: 3600 },
                invoices: [issuedOriginalRow()],
            })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(calls.uploadedBytes[0]!.toString('latin1')).not.toContain('/Type /EmbeddedFile')
            const alerts = postSlackMessageMock.mock.calls.map(([text]) => text)
            expect(alerts).toContainEqual(expect.stringMatching(/PB-CON26-002.*plain PDF.*does not add up/))
        })

        test.each(['correction', 'cancellation'])(
            'legacy order without total_gross_cents: %s works with consistent amounts',
            async (action) => {
                // Backfilled original snapshot and the correction derive gross = net + VAT.
                const { db, call, calls } = await setup({ order: { total_gross_cents: null }, invoices: [] })

                const res = await call(action)

                expect(res.statusCode).toBe(200)
                const created = db.ticket_invoices.find((r) => r.type === action)
                const sign = action === 'cancellation' ? -1 : 1
                expect(created.snapshot_json).toMatchObject({
                    subtotal_cents: sign * 20000,
                    discount_amount_cents: sign * 1000,
                    vat_amount_cents: sign * 3610,
                    total_gross_cents: sign * 22610,
                })
                expect(calls.uploadedBytes[0]!.toString('latin1')).toContain('/Type /EmbeddedFile')
            }
        )

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
            const mail = accountingMail()
            expect(mail.to).toBe('accounting@example.test')
            expect(mail.subject).toBe(
                `Ausgangsrechnung ${CONFERENCE.title} Ticket – Rechnungsberichtigung PB-CON26-002 zu PB-CON26-001`
            )
            expect(mail.text).toContain('Bezug auf Originalrechnung: PB-CON26-001 vom ')
            expect(mail.html).toBeUndefined() // plain text, not a template
            expect(mail.attachments).toHaveLength(1)
            expect(mail.attachments[0].filename).toBe('Rechnungsberichtigung-PB-CON26-002.pdf')
            // Same bytes as the stored file.
            expect(mail.attachments[0].content.equals(calls.uploadedBytes[0]!)).toBe(true)
            expect(mail.attachments[0].content.subarray(0, 4).toString()).toBe('%PDF')

            // The accounting copy is a separate mail; the customer mail is what issued the document.
            expect(mail.to).not.toBe(BASE_ORDER.purchaser_email)
            expect(db.ticket_invoices.find((r) => r.type === 'correction').sent_at).toEqual(expect.any(String))
            expect(deliverTemplatedEmailMock).toHaveBeenCalledTimes(1)
        })

        test('a cancellation is mailed to accounting with its negative amount', async () => {
            const { call, calls } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('sent')
            expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
            const mail = accountingMail()
            expect(mail.subject).toBe(
                `Ausgangsrechnung ${CONFERENCE.title} Ticket – Stornorechnung (Gutschrift) PB-CON26-002 zu PB-CON26-001`
            )
            expect(mail.text).toMatch(/Bruttobetrag: -\d/)
            expect(mail.attachments[0].filename).toBe('Stornorechnung-PB-CON26-002.pdf')
            expect(mail.attachments[0].content.equals(calls.uploadedBytes[0]!)).toBe(true)
        })

        test('a pre-issuance regenerate sends the new version, marked as replacing the previous one', async () => {
            const { call, calls } = await setup({
                invoices: [issuedOriginalRow({ sent_at: null })],
                env: ACCOUNTING_ENV,
            })

            const res = await call('regenerate')

            expect(res.statusCode).toBe(200)
            expect(res.body.accounting_mail).toBe('sent')
            const mail = accountingMail()
            expect(mail.subject).toBe(
                `Ausgangsrechnung ${CONFERENCE.title} Ticket – Rechnung PB-CON26-001 (ersetzt vorherige Fassung)`
            )
            expect(mail.attachments[0].filename).toBe('Rechnung-PB-CON26-001.pdf')
            expect(mail.attachments[0].content.equals(calls.uploadedBytes[0]!)).toBe(true)
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
            const mail = accountingMail()
            expect(mail.subject).toBe(
                `Ausgangsrechnung ${CONFERENCE.title} Ticket – Rechnungsberichtigung PB-CON26-002 zu PB-CON26-001 (ersetzt vorherige Fassung)`
            )
            expect(mail.text).toContain('Bezug auf Originalrechnung: PB-CON26-001 vom ')
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
            // Issued by the customer mail, independent of the failed accounting copy.
            expect(db.ticket_invoices.find((r) => r.type === 'cancellation')).toMatchObject({
                invoice_number: 'PB-CON26-002',
                sent_at: expect.any(String),
            })
        })

        test('blocked operations and internal orders send nothing', async () => {
            const blocked = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })
            expect((await blocked.call('regenerate')).statusCode).toBe(400)

            const internal = await setup({ order: { is_internal: true }, env: ACCOUNTING_ENV })
            expect((await internal.call('correction')).statusCode).toBe(400)

            expect(sendRawEmailMock).not.toHaveBeenCalled()
            expect(deliverTemplatedEmailMock).not.toHaveBeenCalled()
        })
    })

    describe('customer mail', () => {
        function customerMailCall() {
            expect(deliverTemplatedEmailMock).toHaveBeenCalledTimes(1)
            const [options, emailContext] = deliverTemplatedEmailMock.mock.calls[0]!
            return { options, emailContext: emailContext as any }
        }

        test('a correction is mailed to the purchaser, CC billing_email, with the stored PDF — and issued', async () => {
            const { call, calls, db } = await setup({
                order: { billing_email: 'billing@example.de' },
                invoices: [issuedOriginalRow()],
            })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(res.body.customer_mail).toBe('sent')

            const { options, emailContext } = customerMailCall()
            expect(options).toMatchObject({
                templateKey: 'ticket_invoice_correction',
                to: 'erika@example.de',
                cc: 'billing@example.de',
                data: {
                    purchaser_name: 'Erika Musterfrau',
                    conference_title: 'programmier.con 2026',
                    order_number: 'ORD-2026-ABC123',
                    invoice_number: 'PB-CON26-002',
                    reference_invoice_number: 'PB-CON26-001',
                    reference_invoice_date: '20.01.2026',
                },
            })
            expect(options.data.invoice_date).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
            expect(options.attachments).toHaveLength(1)
            expect(options.attachments![0]!.filename).toBe('Rechnungsberichtigung-PB-CON26-002.pdf')
            expect(options.attachments![0]!.contentType).toBe('application/pdf')
            expect(options.attachments![0]!.content.equals(calls.uploadedBytes[0]!)).toBe(true)
            // Through the templated customer mail path; no accounting copy without ACCOUNTING_INVOICE_EMAIL.
            expect(emailContext.services.MailService).toBeDefined()
            expect(sendRawEmailMock).not.toHaveBeenCalled()

            // Successful send stamps sent_at on the new document row only.
            const correction = db.ticket_invoices.find((r) => r.type === 'correction')
            expect(correction.sent_at).toEqual(expect.any(String))
            const stamps = calls.updates.filter((u) => u.collection === 'ticket_invoices')
            expect(stamps).toEqual([
                { collection: 'ticket_invoices', id: correction.id, data: { sent_at: correction.sent_at } },
            ])
            expect(postSlackMessageMock).not.toHaveBeenCalled()
        })

        test('a cancellation is mailed with its own template and without CC when billing_email is empty', async () => {
            const { call, db } = await setup({ order: { billing_email: null }, invoices: [issuedOriginalRow()] })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body.customer_mail).toBe('sent')
            const { options } = customerMailCall()
            expect(options.templateKey).toBe('ticket_invoice_cancellation')
            expect(options.to).toBe('erika@example.de')
            expect(options.cc).toBeUndefined()
            expect(options.data).toMatchObject({
                invoice_number: 'PB-CON26-002',
                reference_invoice_number: 'PB-CON26-001',
            })
            expect(options.attachments![0]!.filename).toBe('Stornorechnung-PB-CON26-002.pdf')
            expect(db.ticket_invoices.find((r) => r.type === 'cancellation').sent_at).toEqual(expect.any(String))
        })

        test('send failure: endpoint still answers 200, Slack is alerted, sent_at stays null, accounting still gets its copy', async () => {
            deliverTemplatedEmailMock.mockResolvedValue('failed')
            const { call, db } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

            const res = await call('correction')

            expect(res.statusCode).toBe(200)
            expect(res.body).toMatchObject({
                invoice_number: 'PB-CON26-002',
                customer_mail: 'failed',
                accounting_mail: 'sent',
            })
            expect(sendRawEmailMock).toHaveBeenCalledTimes(1) // accounting copy, independent of the customer mail
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            const slack = postSlackMessageMock.mock.calls[0]![0]
            expect(slack).toContain('Rechnungsberichtigung PB-CON26-002')
            expect(slack).toContain('ORD-2026-ABC123')
            expect(slack).toContain('sent_at')
            const correction = db.ticket_invoices.find((r) => r.type === 'correction')
            expect(correction).toMatchObject({ invoice_number: 'PB-CON26-002', sent_at: null })
        })

        test.each(['correction', 'cancellation'] as const)(
            '%s: the customer mail goes out before the accounting copy (which may retry)',
            async (action) => {
                const { call } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

                const res = await call(action)

                expect(res.body).toMatchObject({ customer_mail: 'sent', accounting_mail: 'sent' })
                const customerAt = deliverTemplatedEmailMock.mock.invocationCallOrder[0]!
                const accountingAt = sendRawEmailMock.mock.invocationCallOrder[0]!
                expect(customerAt).toBeLessThan(accountingAt)
            }
        )

        test('a slow, failing accounting copy does not hold up or affect the customer mail', async () => {
            sendRawEmailMock.mockResolvedValue(false)
            const { call, db } = await setup({ invoices: [issuedOriginalRow()], env: ACCOUNTING_ENV })

            const res = await call('correction')

            expect(res.body).toMatchObject({ customer_mail: 'sent', accounting_mail: 'failed' })
            expect(sendRawEmailMock).toHaveBeenCalledTimes(3)
            // Issued by the customer mail before the accounting retries started.
            expect(deliverTemplatedEmailMock.mock.invocationCallOrder[0]!).toBeLessThan(
                sendRawEmailMock.mock.invocationCallOrder[0]!
            )
            expect(db.ticket_invoices.find((r) => r.type === 'correction').sent_at).toEqual(expect.any(String))
        })

        test('a throwing mail helper is contained as a failure as well', async () => {
            deliverTemplatedEmailMock.mockRejectedValue(new Error('boom'))
            const { call, db } = await setup({ invoices: [issuedOriginalRow()] })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body.customer_mail).toBe('failed')
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(db.ticket_invoices.find((r) => r.type === 'cancellation').sent_at).toBeNull()
        })

        test('missing template: explicit failure naming the template, no fallback mail, sent_at stays null', async () => {
            deliverTemplatedEmailMock.mockResolvedValue('template_missing')
            const { call, db, logger } = await setup({ invoices: [issuedOriginalRow()] })

            const res = await call('cancellation')

            expect(res.statusCode).toBe(200)
            expect(res.body.customer_mail).toBe('template_missing')
            expect(deliverTemplatedEmailMock).toHaveBeenCalledTimes(1)
            expect(sendRawEmailMock).not.toHaveBeenCalled()
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(postSlackMessageMock.mock.calls[0]![0]).toContain('ticket_invoice_cancellation')
            expect(logger.error.mock.calls.map((c) => String(c[0])).join('\n')).toContain('ticket_invoice_cancellation')
            expect(db.ticket_invoices.find((r) => r.type === 'cancellation').sent_at).toBeNull()
        })

        test('a sent correction counts as issued: regenerate is blocked, a further correction is possible', async () => {
            const { call } = await setup({ invoices: [issuedOriginalRow()] })
            expect((await call('correction')).body.customer_mail).toBe('sent')

            const regenerate = await call('regenerate')
            expect(regenerate.statusCode).toBe(400)
            expect(regenerate.body.error).toContain('already been issued')

            const second = await call('correction')
            expect(second.statusCode).toBe(200)
            expect(second.body).toMatchObject({ invoice_number: 'PB-CON26-003', corrects: 'PB-CON26-002' })
        })

        test('after a failed customer mail, regenerating the correction does not mail the customer either', async () => {
            deliverTemplatedEmailMock.mockResolvedValueOnce('failed')
            const { call, db } = await setup({ invoices: [issuedOriginalRow()] })
            expect((await call('correction')).body.customer_mail).toBe('failed')
            deliverTemplatedEmailMock.mockClear()

            const res = await call('regenerate')

            expect(res.statusCode).toBe(200)
            expect(res.body.invoice_number).toBe('PB-CON26-002')
            expect(res.body.customer_mail).toBeUndefined()
            expect(deliverTemplatedEmailMock).not.toHaveBeenCalled()
            expect(db.ticket_invoices.find((r) => r.type === 'correction').sent_at).toBeNull()
        })
    })
})

// Invoice PDFs must not land in the public file library. The folder lookup itself
// (env var, unset warning + Slack alert) is covered in
// shared/__tests__/secure-invoice-folder.test.ts; here it is stubbed, which also
// keeps the unset-folder Slack alert offline for the empty `env` above.
jest.mock('../../shared/secure-invoice-folder.ts', () => ({
    ...jest.requireActual<object>('../../shared/secure-invoice-folder.ts'),
    invoiceFilesFolder: () => 'folder-invoices',
}))

describe('invoice-lifecycle upload folder', () => {
    const correctionRow = () =>
        issuedOriginalRow({
            id: 'doc-correction-1',
            type: 'correction',
            invoice_number: 'PB-CON26-002',
            related_invoice: 'doc-original',
            date_created: '2026-02-01T00:00:00.000Z',
            sent_at: null,
        })

    test.each([
        ['regenerate (invoice)', 'regenerate', () => [issuedOriginalRow({ sent_at: null })]],
        ['regenerate (correction)', 'regenerate', () => [issuedOriginalRow(), correctionRow()]],
        ['correction', 'correction', () => [issuedOriginalRow()]],
        ['cancellation', 'cancellation', () => [issuedOriginalRow()]],
    ])('%s uploads the PDF into the invoice folder', async (_label, action, invoices) => {
        const { call, calls } = await setup({ invoices: invoices() })

        const res = await call(action)

        expect(res.statusCode).toBe(200)
        expect(calls.uploads).toHaveLength(1)
        expect(calls.uploads[0].folder).toBe('folder-invoices')
    })
})
