import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

import { generateInvoiceNumber } from '../invoice-generator.ts'
import {
    buildInvoiceSnapshot,
    ensureInvoiceDocuments,
    findCancellationFor,
    findCurrentInvoiceDocument,
    issueOriginalInvoice,
    markInvoiceSent,
    negateInvoiceSnapshot,
    parseInvoiceSnapshot,
    renderAndUploadInvoice,
    type InvoiceDocument,
    type InvoiceOrder,
    type InvoiceSnapshot,
} from '../invoice-service.ts'

const ORDER: InvoiceOrder & { order_number: string } = {
    id: 'order-1',
    order_number: 'ORD-2026-ABC123',
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
    ticket_type: 'early_bird',
}

function fakeFilesService() {
    const uploads: any[] = []
    return {
        uploads,
        uploadOne: jest.fn(async (_stream: any, meta: any) => {
            uploads.push(meta)
            return `file-${uploads.length}`
        }),
    }
}

function fakeInvoicesService(rows: any[] = []) {
    let seq = 0
    const service = {
        rows,
        creates: [] as any[],
        updates: [] as any[],
        createOne: jest.fn(async (data: any) => {
            const id = `doc-${++seq}`
            const row = { id, date_created: new Date(2026, 0, seq).toISOString(), ...data }
            rows.push(row)
            service.creates.push(row)
            return id
        }),
        updateOne: jest.fn(async (id: string, data: any) => {
            service.updates.push({ id, data })
            const row = rows.find((r) => r.id === id)
            if (row) Object.assign(row, data)
            return id
        }),
        readByQuery: jest.fn(async (query: any) => {
            let result = [...rows]
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
            return result
        }),
    }
    return service
}

describe('buildInvoiceSnapshot', () => {
    test('captures billing data and derives per-ticket price from the pre-discount subtotal', () => {
        const snapshot = buildInvoiceSnapshot(ORDER, 'programmier.con 2026', 2)

        expect(snapshot).toMatchObject({
            order_id: 'order-1',
            order_number: 'ORD-2026-ABC123',
            purchaser_name: 'Erika Musterfrau',
            purchaser_email: 'erika@example.de',
            company_name: 'Beispiel GmbH',
            company_vat_id: 'DE123456789',
            conference_title: 'programmier.con 2026',
            ticket_type: 'early_bird',
            ticket_count: 2,
            subtotal_cents: 20000,
            discount_amount_cents: 1000,
            vat_amount_cents: 3610,
            total_gross_cents: 22610,
        })
        // 20000 / 2 tickets = 10000 net, * 1.19 = 11900 gross per ticket
        expect(snapshot.unit_price_gross_cents).toBe(11900)
    })

    test('falls back to total_cents when subtotal/total_gross are missing', () => {
        const snapshot = buildInvoiceSnapshot(
            { ...ORDER, subtotal_cents: null, total_gross_cents: null, discount_amount_cents: null },
            'Conf',
            1
        )
        expect(snapshot.subtotal_cents).toBe(19000)
        expect(snapshot.total_gross_cents).toBe(19000)
        expect(snapshot.discount_amount_cents).toBe(0)
    })
})

describe('negateInvoiceSnapshot', () => {
    test('flips every monetary amount and keeps the rest', () => {
        const snapshot = buildInvoiceSnapshot(ORDER, 'Conf', 2)
        const negated = negateInvoiceSnapshot(snapshot)

        expect(negated.unit_price_gross_cents).toBe(-snapshot.unit_price_gross_cents)
        expect(negated.subtotal_cents).toBe(-20000)
        expect(negated.discount_amount_cents).toBe(-1000)
        expect(negated.vat_amount_cents).toBe(-3610)
        expect(negated.total_gross_cents).toBe(-22610)
        expect(negated.ticket_count).toBe(2)
        expect(negated.purchaser_name).toBe('Erika Musterfrau')
    })
})

describe('parseInvoiceSnapshot', () => {
    test('passes objects through, parses strings, rejects garbage', () => {
        const snapshot = buildInvoiceSnapshot(ORDER, 'Conf', 1)
        expect(parseInvoiceSnapshot(snapshot)).toBe(snapshot)
        expect(parseInvoiceSnapshot(JSON.stringify(snapshot))).toEqual(snapshot)
        expect(parseInvoiceSnapshot('{not json')).toBeNull()
        expect(parseInvoiceSnapshot(null)).toBeNull()
    })
})

describe('findCurrentInvoiceDocument / findCancellationFor', () => {
    const docs = [
        { id: 'a', type: 'original' },
        { id: 'b', type: 'correction', related_invoice: 'a' },
        { id: 'c', type: 'cancellation', related_invoice: 'b' },
    ] as InvoiceDocument[]

    test('the latest original/correction is authoritative — never a cancellation', () => {
        expect(findCurrentInvoiceDocument(docs)?.id).toBe('b')
        expect(findCurrentInvoiceDocument([])).toBeNull()
    })

    test('finds the cancellation referencing a document', () => {
        expect(findCancellationFor(docs, 'b')?.id).toBe('c')
        expect(findCancellationFor(docs, 'a')).toBeNull()
    })
})

describe('generateInvoiceNumber', () => {
    const service = (nr: string | null) => fakeInvoicesService(nr ? [{ invoice_number: nr }] : [])

    test('takes the maximum across ticket_orders AND ticket_invoices', async () => {
        expect(await generateInvoiceNumber(service('PB-CON26-005'), service('PB-CON26-007'), 2026)).toBe('PB-CON26-008')
        expect(await generateInvoiceNumber(service('PB-CON26-009'), service('PB-CON26-002'), 2026)).toBe('PB-CON26-010')
    })

    test('starts at 001 for a fresh series', async () => {
        expect(await generateInvoiceNumber(service(null), service(null), 2026)).toBe('PB-CON26-001')
    })
})

describe('renderAndUploadInvoice', () => {
    test.each([
        ['invoice', 'Rechnung-PB-CON26-001.pdf', 'Rechnung PB-CON26-001'],
        ['correction', 'Rechnungsberichtigung-PB-CON26-001.pdf', 'Rechnungsberichtigung PB-CON26-001'],
        ['cancellation', 'Stornorechnung-PB-CON26-001.pdf', 'Stornorechnung PB-CON26-001'],
    ] as const)('names the %s document after its kind', async (kind, fileName, title) => {
        const filesService = fakeFilesService()
        const result = await renderAndUploadInvoice({
            snapshot: buildInvoiceSnapshot(ORDER, 'Conf', 2),
            invoiceNumber: 'PB-CON26-001',
            invoiceDate: new Date('2026-02-01T10:00:00Z'),
            documentKind: kind,
            referenceNumber: kind === 'invoice' ? undefined : 'PB-CON26-000',
            referenceDate: kind === 'invoice' ? undefined : new Date('2026-01-15T10:00:00Z'),
            filesService,
        })

        expect(result.invoiceFileName).toBe(fileName)
        expect(result.fileId).toBe('file-1')
        expect(result.pdfBuffer.subarray(0, 4).toString()).toBe('%PDF')
        expect(filesService.uploads[0]).toMatchObject({
            type: 'application/pdf',
            filename_download: fileName,
            title,
        })
    })
})

describe('issueOriginalInvoice / markInvoiceSent', () => {
    let ordersService: { updateOne: jest.Mock }

    beforeEach(() => {
        ordersService = { updateOne: jest.fn(async () => 'order-1') } as any
    })

    test('creates the document row as NOT yet sent and syncs the order pointers', async () => {
        const invoicesService = fakeInvoicesService()
        const result = await issueOriginalInvoice({
            order: ORDER,
            conferenceTitle: 'Conf',
            ticketCount: 2,
            invoiceNumber: 'PB-CON26-001',
            invoiceDate: new Date('2026-02-01T10:00:00Z'),
            ordersService,
            invoicesService,
            filesService: fakeFilesService(),
        })

        expect(result.documentId).toBe('doc-1')
        expect(invoicesService.creates[0]).toMatchObject({
            order: 'order-1',
            type: 'original',
            invoice_number: 'PB-CON26-001',
            invoice_file: 'file-1',
            related_invoice: null,
            sent_at: null,
        })
        expect((invoicesService.creates[0].snapshot_json as InvoiceSnapshot).total_gross_cents).toBe(22610)
        expect(ordersService.updateOne).toHaveBeenCalledWith('order-1', {
            invoice_number: 'PB-CON26-001',
            invoice_file: 'file-1',
        })
    })

    test('markInvoiceSent stamps sent_at on the document row', async () => {
        const invoicesService = fakeInvoicesService([{ id: 'doc-1', sent_at: null }])
        const sentAt = new Date('2026-02-01T10:05:00Z')
        await markInvoiceSent(invoicesService, 'doc-1', sentAt)
        expect(invoicesService.updates).toEqual([{ id: 'doc-1', data: { sent_at: sentAt.toISOString() } }])
    })
})

describe('ensureInvoiceDocuments (lazy backfill of pre-existing invoices)', () => {
    const legacyOrder = {
        ...ORDER,
        invoice_number: 'PB-CON26-003',
        invoice_file: 'file-legacy',
        date_paid: '2026-01-20T09:00:00.000Z',
    }

    test('backfills the original document for a legacy order and treats it as issued', async () => {
        const invoicesService = fakeInvoicesService()
        const documents = await ensureInvoiceDocuments({
            order: legacyOrder,
            conferenceTitle: 'Conf',
            ticketCount: 2,
            invoicesService,
        })

        expect(documents).toHaveLength(1)
        expect(invoicesService.creates[0]).toMatchObject({
            order: 'order-1',
            type: 'original',
            invoice_number: 'PB-CON26-003',
            invoice_file: 'file-legacy',
            invoice_date: '2026-01-20T09:00:00.000Z',
            // Pre-existing invoices were all emailed on payment: issued at date_paid.
            sent_at: '2026-01-20T09:00:00.000Z',
        })
    })

    test('does not backfill when document rows already exist', async () => {
        const invoicesService = fakeInvoicesService([
            { id: 'doc-1', order: 'order-1', type: 'original', invoice_number: 'PB-CON26-003' },
        ])
        const documents = await ensureInvoiceDocuments({
            order: legacyOrder,
            conferenceTitle: 'Conf',
            ticketCount: 2,
            invoicesService,
        })
        expect(documents).toHaveLength(1)
        expect(invoicesService.createOne).not.toHaveBeenCalled()
    })

    test('does not backfill when the order never had an invoice', async () => {
        const invoicesService = fakeInvoicesService()
        const documents = await ensureInvoiceDocuments({
            order: { ...ORDER, invoice_number: null },
            conferenceTitle: 'Conf',
            ticketCount: 2,
            invoicesService,
        })
        expect(documents).toHaveLength(0)
        expect(invoicesService.createOne).not.toHaveBeenCalled()
    })
})
