import { beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('../postSlackMessage.ts', () => ({ postSlackMessage: jest.fn(async () => undefined) }))

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

/**
 * The unset-folder alert fires once per process, i.e. once per module instance.
 * Load a fresh instance (and the matching Slack mock) for every test.
 */
async function load() {
    jest.resetModules()
    const folderModule = await import('../secure-invoice-folder.ts')
    const slackModule = await import('../postSlackMessage.ts')
    const serviceModule = await import('../invoice-service.ts')
    return {
        invoiceFilesFolder: folderModule.invoiceFilesFolder,
        postSlackMessageMock: jest.mocked(slackModule.postSlackMessage),
        renderAndUploadInvoice: serviceModule.renderAndUploadInvoice,
        issueOriginalInvoice: serviceModule.issueOriginalInvoice,
    }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

let logger: { warn: jest.Mock<(message: string) => void>; error: jest.Mock<(message: string) => void> }

beforeEach(() => {
    logger = { warn: jest.fn(), error: jest.fn() }
})

describe('invoiceFilesFolder', () => {
    test('returns the configured folder id without warning', async () => {
        const { invoiceFilesFolder, postSlackMessageMock } = await load()

        expect(invoiceFilesFolder({ INVOICE_FILES_FOLDER: ' folder-invoices ' }, logger)).toBe('folder-invoices')
        expect(logger.warn).not.toHaveBeenCalled()
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('unset or empty: returns undefined, warns and alerts Slack once per process', async () => {
        const { invoiceFilesFolder, postSlackMessageMock } = await load()

        expect(invoiceFilesFolder({}, logger)).toBeUndefined()
        expect(invoiceFilesFolder({ INVOICE_FILES_FOLDER: '' }, logger)).toBeUndefined()
        expect(invoiceFilesFolder({ INVOICE_FILES_FOLDER: '   ' }, logger)).toBeUndefined()

        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.warn.mock.calls[0]![0]).toContain('INVOICE_FILES_FOLDER is not set')
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        expect(postSlackMessageMock.mock.calls[0]![0]).toContain('public file library')
    })

    test('a failing Slack alert is logged, never thrown', async () => {
        const { invoiceFilesFolder, postSlackMessageMock } = await load()
        postSlackMessageMock.mockRejectedValueOnce(new Error('slack down'))

        expect(invoiceFilesFolder({}, logger)).toBeUndefined()
        await flush()

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('slack down'))
    })
})

const SNAPSHOT = {
    order_id: 'order-1',
    order_number: 'ORD-2026-ABC123',
    purchaser_name: 'Erika Musterfrau',
    purchaser_email: 'erika@example.de',
    company_name: null,
    company_vat_id: null,
    billing_address_line1: 'Musterstraße 1',
    billing_address_line2: null,
    billing_city: 'Bad Nauheim',
    billing_postal_code: '61231',
    billing_country: 'Deutschland',
    conference_title: 'programmier.con 2026',
    ticket_type: 'regular',
    ticket_count: 1,
    unit_price_gross_cents: 11900,
    subtotal_cents: 10000,
    discount_amount_cents: 0,
    vat_amount_cents: 1900,
    total_gross_cents: 11900,
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

describe('invoice uploads', () => {
    test('renderAndUploadInvoice uploads into the given folder', async () => {
        const { renderAndUploadInvoice } = await load()
        const filesService = fakeFilesService()

        await renderAndUploadInvoice({
            snapshot: SNAPSHOT,
            invoiceNumber: 'PB-CON26-002',
            invoiceDate: new Date('2026-02-01T10:00:00Z'),
            documentKind: 'correction',
            referenceNumber: 'PB-CON26-001',
            referenceDate: new Date('2026-01-20T10:00:00Z'),
            filesService,
            folder: 'folder-invoices',
        })

        expect(filesService.uploads[0].folder).toBe('folder-invoices')
    })

    test('renderAndUploadInvoice without a folder still uploads (no folder key)', async () => {
        const { renderAndUploadInvoice } = await load()
        const filesService = fakeFilesService()

        await renderAndUploadInvoice({
            snapshot: SNAPSHOT,
            invoiceNumber: 'PB-CON26-001',
            invoiceDate: new Date('2026-01-20T10:00:00Z'),
            filesService,
        })

        expect(filesService.uploads).toHaveLength(1)
        expect(filesService.uploads[0]).not.toHaveProperty('folder')
    })

    test('issueOriginalInvoice passes the folder through to the upload', async () => {
        const { issueOriginalInvoice } = await load()
        const filesService = fakeFilesService()

        await issueOriginalInvoice({
            order: {
                id: 'order-1',
                order_number: 'ORD-2026-ABC123',
                purchaser_first_name: 'Erika',
                purchaser_last_name: 'Musterfrau',
                purchaser_email: 'erika@example.de',
                company_name: null,
                company_vat_id: null,
                billing_address_line1: 'Musterstraße 1',
                billing_address_line2: null,
                billing_city: 'Bad Nauheim',
                billing_postal_code: '61231',
                billing_country: 'Deutschland',
                subtotal_cents: 10000,
                discount_amount_cents: 0,
                total_cents: 10000,
                total_gross_cents: 11900,
                vat_amount_cents: 1900,
                ticket_type: 'regular',
            },
            conferenceTitle: 'programmier.con 2026',
            ticketCount: 1,
            invoiceNumber: 'PB-CON26-001',
            invoiceDate: new Date('2026-01-20T10:00:00Z'),
            ordersService: { updateOne: jest.fn(async () => 'order-1') },
            invoicesService: { createOne: jest.fn(async () => 'doc-1') },
            filesService,
            folder: 'folder-invoices',
        })

        expect(filesService.uploads[0].folder).toBe('folder-invoices')
    })
})
