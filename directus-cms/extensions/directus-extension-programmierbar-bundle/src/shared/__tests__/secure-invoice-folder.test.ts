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

        // Not delivered, so the next invoice alerts again.
        expect(invoiceFilesFolder({}, logger)).toBeUndefined()
        expect(postSlackMessageMock).toHaveBeenCalledTimes(2)
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

const ORDER = {
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
            order: ORDER,
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

/** A files service that rejects every upload into `rejectFolder` (like an unknown folder id). */
function rejectingFilesService(options: { rejectFolder?: string; rejectAll?: boolean } = {}) {
    const uploads: any[] = []
    return {
        uploads,
        uploadOne: jest.fn(async (_stream: any, meta: any) => {
            uploads.push(meta)
            if (options.rejectAll) {
                throw new Error(`storage unavailable (attempt ${uploads.length})`)
            }
            if (meta.folder === options.rejectFolder) {
                throw new Error(`Invalid foreign key "${meta.folder}" for field "folder"`)
            }
            return `file-${uploads.length}`
        }),
    }
}

describe('invalid invoice folder', () => {
    const render = (renderAndUploadInvoice: any, filesService: any, invoiceNumber = 'PB-CON26-001') =>
        renderAndUploadInvoice({
            snapshot: SNAPSHOT,
            invoiceNumber,
            invoiceDate: new Date('2026-01-20T10:00:00Z'),
            filesService,
            folder: 'not-a-folder',
            logger,
        })

    test('falls back to the public library once, warns and alerts Slack (once per process)', async () => {
        const { renderAndUploadInvoice, postSlackMessageMock } = await load()
        const filesService = rejectingFilesService({ rejectFolder: 'not-a-folder' })

        const result = await render(renderAndUploadInvoice, filesService)

        expect(result.fileId).toBe('file-2')
        expect(filesService.uploads.map((meta) => meta.folder)).toEqual(['not-a-folder', undefined])
        expect(filesService.uploads[1]).not.toHaveProperty('folder')
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('PB-CON26-001'))
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const alert = postSlackMessageMock.mock.calls[0]![0]
        expect(alert).toContain('PB-CON26-001')
        expect(alert).toContain('"not-a-folder"')
        expect(alert).toContain('public file library')
        expect(alert).not.toContain('Musterfrau')

        // A second invoice still falls back and is logged, without a second Slack alert.
        await render(renderAndUploadInvoice, filesService, 'PB-CON26-002')
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('PB-CON26-002'))
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
    })

    test('the paid-hook flow continues: the document row points at the fallback file', async () => {
        const { issueOriginalInvoice } = await load()
        const filesService = rejectingFilesService({ rejectFolder: 'not-a-folder' })
        const invoicesService = { createOne: jest.fn(async (_data: any) => 'doc-1') }
        const ordersService = { updateOne: jest.fn(async (_id: any, _data: any) => 'order-1') }

        const result = await issueOriginalInvoice({
            order: ORDER,
            conferenceTitle: 'programmier.con 2026',
            ticketCount: 1,
            invoiceNumber: 'PB-CON26-001',
            invoiceDate: new Date('2026-01-20T10:00:00Z'),
            ordersService,
            invoicesService,
            filesService,
            folder: 'not-a-folder',
            logger,
        })

        expect(result.fileId).toBe('file-2')
        expect(invoicesService.createOne.mock.calls[0]![0].invoice_file).toBe('file-2')
        expect(ordersService.updateOne).toHaveBeenCalledWith(
            'order-1',
            expect.objectContaining({ invoice_file: 'file-2' })
        )
    })

    test('retries the Slack alert with the next invoice when it could not be delivered', async () => {
        const { renderAndUploadInvoice, postSlackMessageMock } = await load()
        postSlackMessageMock.mockRejectedValueOnce(new Error('slack down'))
        const filesService = rejectingFilesService({ rejectFolder: 'not-a-folder' })

        await render(renderAndUploadInvoice, filesService)
        await flush()
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('slack down'))

        await render(renderAndUploadInvoice, filesService, 'PB-CON26-002')
        expect(postSlackMessageMock).toHaveBeenCalledTimes(2)
        expect(postSlackMessageMock.mock.calls[1]![0]).toContain('PB-CON26-002')
    })

    test('throws when the fallback upload fails too, without alerting', async () => {
        const { renderAndUploadInvoice, postSlackMessageMock } = await load()
        const filesService = rejectingFilesService({ rejectAll: true })

        await expect(render(renderAndUploadInvoice, filesService)).rejects.toThrow('attempt 2')
        expect(filesService.uploads).toHaveLength(2)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('without a folder there is no retry', async () => {
        const { renderAndUploadInvoice, postSlackMessageMock } = await load()
        const filesService = rejectingFilesService({ rejectAll: true })

        await expect(
            renderAndUploadInvoice({
                snapshot: SNAPSHOT,
                invoiceNumber: 'PB-CON26-001',
                invoiceDate: new Date('2026-01-20T10:00:00Z'),
                filesService,
                logger,
            })
        ).rejects.toThrow('attempt 1')
        expect(filesService.uploads).toHaveLength(1)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })
})
