import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { deliverTemplatedEmail } from '../email-service.ts'
import {
    MARK_SENT_ATTEMPTS,
    recordInvoiceSent,
    sendInvoiceDocumentToCustomer,
    type CustomerInvoiceDocument,
} from '../invoice-customer-mail.ts'
import { postSlackMessage } from '../postSlackMessage.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))
jest.mock('../email-service.ts', () => ({ deliverTemplatedEmail: jest.fn() }))
jest.mock('../postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))

const deliverMock = jest.mocked(deliverTemplatedEmail)
const slackMock = jest.mocked(postSlackMessage)

function logger() {
    return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

const DOC: CustomerInvoiceDocument = {
    documentKind: 'cancellation',
    documentId: 'doc-7',
    invoiceNumber: 'PB-CON26-007',
    invoiceDate: new Date('2026-06-01T10:00:00.000Z'),
    referenceNumber: 'PB-CON26-001',
    referenceDate: new Date('2026-01-20T09:00:00.000Z'),
    pdfBuffer: Buffer.from('%PDF'),
    invoiceFileName: 'Stornorechnung-PB-CON26-007.pdf',
}

const ORDER = {
    order_number: 'ORD-1',
    purchaser_first_name: 'Erika',
    purchaser_last_name: 'Musterfrau',
    purchaser_email: 'buyer@example.test',
    billing_email: '',
}

function options(invoicesService: any, overrides: Record<string, any> = {}) {
    return {
        order: ORDER,
        conferenceTitle: 'programmier.con 2026',
        invoicesService,
        emailContext: {} as any,
        logger: logger(),
        source: 'test',
        ...overrides,
    }
}

beforeEach(() => {
    deliverMock.mockReset()
    slackMock.mockReset()
})

describe('recordInvoiceSent', () => {
    test('stamps sent_at once', async () => {
        const updateOne = jest.fn<(id: string, data: any) => Promise<void>>().mockResolvedValue(undefined)
        const ok = await recordInvoiceSent({
            invoicesService: { updateOne },
            documentId: 'doc-1',
            documentLabel: 'Rechnung',
            invoiceNumber: 'PB-CON26-001',
            orderNumber: 'ORD-1',
            recipient: 'buyer@example.test',
            logger: logger(),
            source: 'test',
        })
        expect(ok).toBe(true)
        expect(updateOne).toHaveBeenCalledWith('doc-1', { sent_at: expect.any(String) })
        expect(slackMock).not.toHaveBeenCalled()
    })

    test('retries with the same timestamp and escalates to Slack when it keeps failing', async () => {
        const updateOne = jest.fn<(id: string, data: any) => Promise<void>>().mockRejectedValue(new Error('db down'))
        const ok = await recordInvoiceSent({
            invoicesService: { updateOne },
            documentId: 'doc-1',
            documentLabel: 'Stornorechnung',
            invoiceNumber: 'PB-CON26-007',
            orderNumber: 'ORD-1',
            recipient: 'buyer@example.test',
            logger: logger(),
            source: 'test',
        })
        expect(ok).toBe(false)
        expect(updateOne).toHaveBeenCalledTimes(MARK_SENT_ATTEMPTS)
        const stamps = new Set(updateOne.mock.calls.map((c) => c[1].sent_at))
        expect(stamps.size).toBe(1)
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toContain('Stornorechnung PB-CON26-007')
        expect(slackMock.mock.calls[0]![0]).toContain('db down')
    })
})

describe('sendInvoiceDocumentToCustomer', () => {
    test('a sent mail whose sent_at stamp keeps failing is still reported as sent (Slack has the stamp)', async () => {
        deliverMock.mockResolvedValue('sent')
        const updateOne = jest.fn<(id: string, data: any) => Promise<void>>().mockRejectedValue(new Error('db down'))

        await expect(sendInvoiceDocumentToCustomer(DOC, options({ updateOne }))).resolves.toBe('sent')
        expect(updateOne).toHaveBeenCalledTimes(MARK_SENT_ATTEMPTS)
        expect(slackMock).toHaveBeenCalledTimes(1)
        expect(slackMock.mock.calls[0]![0]).toContain('sent_at')
    })

    test('passes German dates and no CC for an empty billing_email', async () => {
        deliverMock.mockResolvedValue('sent')
        const updateOne = jest.fn<(id: string, data: any) => Promise<void>>().mockResolvedValue(undefined)

        await sendInvoiceDocumentToCustomer(DOC, options({ updateOne }))

        const sent = deliverMock.mock.calls[0]![0]
        expect(sent.templateKey).toBe('ticket_invoice_cancellation')
        expect(sent.cc).toBeUndefined()
        expect(sent.data).toMatchObject({
            invoice_number: 'PB-CON26-007',
            invoice_date: '01.06.2026',
            reference_invoice_number: 'PB-CON26-001',
            reference_invoice_date: '20.01.2026',
        })
    })

    test('an order without purchaser_email is a failure with a Slack alert, nothing is sent', async () => {
        const updateOne = jest.fn()
        const result = await sendInvoiceDocumentToCustomer(
            DOC,
            options({ updateOne }, { order: { ...ORDER, purchaser_email: null } })
        )
        expect(result).toBe('failed')
        expect(deliverMock).not.toHaveBeenCalled()
        expect(updateOne).not.toHaveBeenCalled()
        expect(slackMock).toHaveBeenCalledTimes(1)
    })

    test('a failing Slack alert is swallowed', async () => {
        deliverMock.mockResolvedValue('template_missing')
        slackMock.mockRejectedValue(new Error('slack down'))
        await expect(sendInvoiceDocumentToCustomer(DOC, options({ updateOne: jest.fn() }))).resolves.toBe(
            'template_missing'
        )
    })
})
