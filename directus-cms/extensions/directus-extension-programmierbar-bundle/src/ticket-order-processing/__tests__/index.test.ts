import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendInvoiceToAccounting } from '../../shared/accounting-mail.ts'
import { deliverTemplatedEmail } from '../../shared/email-service.ts'
import { generateInvoiceNumber } from '../../shared/invoice-generator.ts'
import { issueOriginalInvoice, markInvoiceSent } from '../../shared/invoice-service.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import { generateUniqueTicketCode } from '../../shared/ticket-utils.ts'
import registerHook from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

jest.mock('../../shared/email-service.ts', () => ({
    deliverTemplatedEmail: jest.fn(),
}))
jest.mock('../../shared/settings.ts', () => ({
    getSetting: jest.fn(async () => 'https://www.programmier.bar'),
}))
jest.mock('../../shared/invoice-generator.ts', () => ({
    generateInvoiceNumber: jest.fn(async () => 'PB-CON26-001'),
}))
jest.mock('../../shared/invoice-service.ts', () => ({
    issueOriginalInvoice: jest.fn(),
    markInvoiceSent: jest.fn(),
    // Used by the hook for the document label passed to recordInvoiceSent.
    INVOICE_DOCUMENT_LABEL: {
        invoice: 'Rechnung',
        correction: 'Rechnungsberichtigung',
        cancellation: 'Stornorechnung',
    },
}))
jest.mock('../../shared/ticket-utils.ts', () => ({
    generateUniqueTicketCode: jest.fn(),
    formatPrice: (cents: number) => `${(cents / 100).toFixed(2)} €`,
}))
jest.mock('../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

// Building and sending the accounting mail is covered in shared/__tests__/accounting-mail.test.ts;
// here it only matters that the hook hands over the right document at the right time.
jest.mock('../../shared/accounting-mail.ts', () => ({
    sendInvoiceToAccounting: jest.fn(),
}))

const deliverTemplatedEmailMock = jest.mocked(deliverTemplatedEmail)
const sendInvoiceToAccountingMock = jest.mocked(sendInvoiceToAccounting)
const postSlackMessageMock = jest.mocked(postSlackMessage)
const issueOriginalInvoiceMock = jest.mocked(issueOriginalInvoice)
const markInvoiceSentMock = jest.mocked(markInvoiceSent)
const generateInvoiceNumberMock = jest.mocked(generateInvoiceNumber)
const generateUniqueTicketCodeMock = jest.mocked(generateUniqueTicketCode)

// safeAction detaches the work into its own promise chain and returns void.
// Flushing the microtask queue lets that detached work settle before we assert.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type ActionHandler = (meta: any, ctx: any) => void

const ORDER = {
    id: 'order-1',
    order_number: 'ORD-2026-ABC123',
    conference: 'conf-1',
    purchase_type: 'self',
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
    billing_email: null,
    subtotal_cents: 20000,
    discount_amount_cents: 0,
    total_cents: 20000,
    total_gross_cents: 23800,
    vat_amount_cents: 3800,
    attendees_json: [
        { firstName: 'Erika', lastName: 'Musterfrau', email: 'erika@example.de' },
        { firstName: 'Max', lastName: 'Mustermann', email: 'max@example.de' },
    ],
    ticket_type: 'regular',
    is_internal: false,
}

const CONFERENCE = {
    id: 'conf-1',
    title: 'programmier.con 2026',
    start_on: '2026-03-01',
    end_on: '2026-03-02',
    ticket_max_quantity: null,
}

const ACCOUNTING_ENV = { ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test' }

function setup(orderOverrides: Record<string, any> = {}, env: Record<string, any> = {}) {
    const order = { ...ORDER, ...orderOverrides }
    const serviceInstances: Record<string, any[]> = {}

    class FakeItemsService {
        collection: string
        readOne = jest.fn(async (id: any) => {
            if (this.collection === 'ticket_orders' && id === order.id) return { ...order }
            if (this.collection === 'conferences' && id === CONFERENCE.id) return { ...CONFERENCE }
            return null
        })
        readByQuery = jest.fn(async () => [])
        createOne = jest.fn(async () => 'created-id')
        updateOne = jest.fn(async () => order.id)
        constructor(collection: string, _opts: any) {
            this.collection = collection
            ;(serviceInstances[collection] ||= []).push(this)
        }
    }

    const FilesService = jest.fn().mockImplementation(() => ({}))
    const MailService = jest.fn()
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const actions = new Map<string, ActionHandler>()
    const register = {
        action: (event: string, handler: ActionHandler) => actions.set(event, handler),
        filter: jest.fn(),
    }

    const hookContext = {
        logger,
        services: { ItemsService: FakeItemsService, FilesService, MailService },
        getSchema: async () => ({}),
        env,
    }

    registerHook(register as any, hookContext as any)

    const invoke = async (payload: any, keys: string[] = [order.id]) => {
        actions.get('ticket_orders.items.update')!({ payload, keys }, { accountability: { admin: true } })
        await flush()
    }

    return { order, serviceInstances, actions, invoke, logger, hookContext }
}

beforeEach(() => {
    deliverTemplatedEmailMock.mockReset()
    sendInvoiceToAccountingMock.mockReset()
    sendInvoiceToAccountingMock.mockResolvedValue('sent')
    issueOriginalInvoiceMock.mockReset()
    markInvoiceSentMock.mockReset()
    postSlackMessageMock.mockReset()
    generateInvoiceNumberMock.mockClear()
    generateUniqueTicketCodeMock.mockReset()

    let codeSeq = 0
    generateUniqueTicketCodeMock.mockImplementation(async () => `TICKET-${++codeSeq}`)
    issueOriginalInvoiceMock.mockResolvedValue({
        documentId: 'doc-1',
        fileId: 'file-1',
        pdfBuffer: Buffer.from('%PDF-fake'),
        invoiceFileName: 'Rechnung-PB-CON26-001.pdf',
        snapshot: { conference_title: 'programmier.con 2026' } as any,
    })
    deliverTemplatedEmailMock.mockResolvedValue('sent')
})

describe('ticket-order-processing hook', () => {
    test('does nothing when the status is not being set to paid', async () => {
        const { invoke, serviceInstances } = setup()
        await invoke({ status: 'cancelled' })

        expect(issueOriginalInvoiceMock).not.toHaveBeenCalled()
        expect(deliverTemplatedEmailMock).not.toHaveBeenCalled()
        expect(serviceInstances['ticket_orders']).toBeUndefined()
    })

    test('paid order: generates the invoice document, sends the confirmation email and records issuance', async () => {
        const { invoke, serviceInstances } = setup()
        await invoke({ status: 'paid' })

        // Document generation went through the shared service, in the ticket_invoices collection.
        expect(issueOriginalInvoiceMock).toHaveBeenCalledTimes(1)
        const issueParams = issueOriginalInvoiceMock.mock.calls[0]![0]
        expect(issueParams.invoiceNumber).toBe('PB-CON26-001')
        expect(issueParams.ticketCount).toBe(2)
        // The conference dates become the invoice's Leistungsdatum.
        expect(issueParams.servicePeriod).toEqual({ start_on: '2026-03-01', end_on: '2026-03-02' })
        expect(issueParams.invoicesService).toBe(serviceInstances['ticket_invoices']![0])

        // The confirmation email carries the invoice PDF.
        const confirmation = deliverTemplatedEmailMock.mock.calls.find(
            ([options]) => (options as any).templateKey === 'ticket_order_confirmation'
        )
        expect(confirmation).toBeDefined()
        const options = confirmation![0] as any
        expect(options.to).toBe('erika@example.de')
        expect(options.attachments).toEqual([
            {
                filename: 'Rechnung-PB-CON26-001.pdf',
                content: Buffer.from('%PDF-fake'),
                contentType: 'application/pdf',
            },
        ])

        // Issuance is recorded on the document row after the email went out.
        expect(markInvoiceSentMock).toHaveBeenCalledTimes(1)
        expect(markInvoiceSentMock).toHaveBeenCalledWith(
            serviceInstances['ticket_invoices']![0],
            'doc-1',
            expect.any(Date)
        )

        // Both attendees got their profile invitation.
        const invitations = deliverTemplatedEmailMock.mock.calls.filter(
            ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
        )
        expect(invitations).toHaveLength(2)

        // Tickets were created for both attendees.
        expect(serviceInstances['tickets']![0].createOne).toHaveBeenCalledTimes(2)
    })

    test('does NOT mark the invoice as sent when the confirmation email fails', async () => {
        deliverTemplatedEmailMock.mockResolvedValue('failed')
        const { invoke } = setup()
        await invoke({ status: 'paid' })

        expect(issueOriginalInvoiceMock).toHaveBeenCalledTimes(1)
        expect(markInvoiceSentMock).not.toHaveBeenCalled()
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('retries a failing markInvoiceSent and recovers without escalating', async () => {
        markInvoiceSentMock.mockRejectedValueOnce(new Error('deadlock')).mockResolvedValueOnce(undefined)
        const { invoke } = setup()
        await invoke({ status: 'paid' })

        expect(markInvoiceSentMock).toHaveBeenCalledTimes(2)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('escalates to Slack when markInvoiceSent keeps failing, without crashing the hook', async () => {
        markInvoiceSentMock.mockRejectedValue(new Error('db down'))
        const { invoke, logger } = setup()
        await invoke({ status: 'paid' })

        // All retry attempts were used up.
        expect(markInvoiceSentMock).toHaveBeenCalledTimes(3)

        // A human is notified through Slack, with order + invoice number and the reason.
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const slackMessage = postSlackMessageMock.mock.calls[0]![0]
        expect(slackMessage).toContain('PB-CON26-001')
        expect(slackMessage).toContain('ORD-2026-ABC123')
        expect(slackMessage).toContain('db down')

        // The failure is also logged with the affected order and invoice number.
        const errorLog = logger.error.mock.calls.map((call) => call[0]).join('\n')
        expect(errorLog).toContain('PB-CON26-001')
        expect(errorLog).toContain('ORD-2026-ABC123')

        // The hook carried on: attendees still received their profile invitations.
        const invitations = deliverTemplatedEmailMock.mock.calls.filter(
            ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
        )
        expect(invitations).toHaveLength(2)
    })

    test('a failing Slack escalation is swallowed and the hook still completes', async () => {
        markInvoiceSentMock.mockRejectedValue(new Error('db down'))
        postSlackMessageMock.mockRejectedValue(new Error('slack down'))
        const { invoke } = setup()
        await invoke({ status: 'paid' })

        const invitations = deliverTemplatedEmailMock.mock.calls.filter(
            ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
        )
        expect(invitations).toHaveLength(2)
    })

    test('a failing invoice issuance is escalated to Slack with order, invoice number and reason', async () => {
        issueOriginalInvoiceMock.mockRejectedValue(new Error('storage down'))
        const { invoke } = setup()
        await invoke({ status: 'paid' })

        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const slackMessage = postSlackMessageMock.mock.calls[0]![0]
        expect(slackMessage).toContain('ORD-2026-ABC123')
        expect(slackMessage).toContain('PB-CON26-001')
        expect(slackMessage).toContain('storage down')
    })

    test('internal orders: no invoice document, no confirmation email, but profile invitations', async () => {
        const { invoke } = setup({ is_internal: true })
        await invoke({ status: 'paid' })

        expect(issueOriginalInvoiceMock).not.toHaveBeenCalled()
        expect(markInvoiceSentMock).not.toHaveBeenCalled()
        const templates = deliverTemplatedEmailMock.mock.calls.map(([opts]) => (opts as any).templateKey)
        expect(templates).toEqual(['ticket_profile_invitation', 'ticket_profile_invitation'])
    })

    describe('accounting copy', () => {
        const invitations = () =>
            deliverTemplatedEmailMock.mock.calls.filter(
                ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
            )

        test('hands the original invoice document to the accounting mail, separate from the customer mail', async () => {
            const { invoke, hookContext } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(sendInvoiceToAccountingMock).toHaveBeenCalledTimes(1)
            const [doc, options] = sendInvoiceToAccountingMock.mock.calls[0]!
            const issueParams = issueOriginalInvoiceMock.mock.calls[0]![0]
            expect(doc).toEqual({
                documentKind: 'invoice',
                invoiceNumber: 'PB-CON26-001',
                // The very date printed on the invoice, and the snapshot it was rendered from.
                invoiceDate: issueParams.invoiceDate,
                snapshot: { conference_title: 'programmier.con 2026' },
                pdfBuffer: Buffer.from('%PDF-fake'),
                invoiceFileName: 'Rechnung-PB-CON26-001.pdf',
                orderNumber: 'ORD-2026-ABC123',
            })
            expect(options.env).toBe(hookContext.env)
            expect(options.source).toBe('ticket-order-processing')
            // Goes through the shared email service with the hook's services.
            expect(options.emailContext.services).toBe(hookContext.services)

            // Not piggybacked onto the customer mail.
            const confirmation = deliverTemplatedEmailMock.mock.calls.find(
                ([opts]) => (opts as any).templateKey === 'ticket_order_confirmation'
            )![0] as any
            expect(confirmation.cc).toBeUndefined()
            expect(confirmation.bcc).toBeUndefined()
        })

        test('is not awaited: tickets and customer mails do not wait for a slow accounting copy', async () => {
            // An accounting copy that never settles (e.g. slow mail provider, retries, Slack).
            sendInvoiceToAccountingMock.mockReturnValue(new Promise(() => {}))
            const { invoke, serviceInstances } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(sendInvoiceToAccountingMock).toHaveBeenCalledTimes(1)
            expect(serviceInstances['tickets']![0].createOne).toHaveBeenCalledTimes(2)
            expect(markInvoiceSentMock).toHaveBeenCalledTimes(1) // confirmation mail went out
            expect(invitations()).toHaveLength(2)
        })

        test('an unexpected rejection of the accounting copy is logged, not thrown', async () => {
            sendInvoiceToAccountingMock.mockRejectedValue(new Error('boom'))
            const { invoke, logger } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(invitations()).toHaveLength(2)
            expect(logger.error.mock.calls.map((c) => String(c[0])).join('\n')).toContain('boom')
        })

        test('is sent even when the customer confirmation mail fails — and never stamps sent_at', async () => {
            deliverTemplatedEmailMock.mockResolvedValue('failed')
            const { invoke } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(sendInvoiceToAccountingMock).toHaveBeenCalledTimes(1)
            expect(markInvoiceSentMock).not.toHaveBeenCalled()
        })

        test('a failed accounting copy does not affect the customer flow', async () => {
            sendInvoiceToAccountingMock.mockResolvedValue('failed')
            const { invoke } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            // The customer still got their invoice, issuance is recorded from THAT mail,
            // tickets exist and attendees were invited.
            expect(markInvoiceSentMock).toHaveBeenCalledTimes(1)
            expect(invitations()).toHaveLength(2)
        })

        test('internal orders have no invoice, so nothing goes to accounting', async () => {
            const { invoke } = setup({ is_internal: true }, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(sendInvoiceToAccountingMock).not.toHaveBeenCalled()
        })
    })
})

// The folder lookup itself (env var, unset warning + Slack alert) is covered in
// shared/__tests__/secure-invoice-folder.test.ts; stubbed here so the empty `env`
// above does not trigger the unset-folder Slack alert.
jest.mock('../../shared/secure-invoice-folder.ts', () => ({ invoiceFilesFolder: () => 'folder-invoices' }))

describe('ticket-order-processing invoice folder', () => {
    test('issues the original invoice into the invoice folder', async () => {
        const { invoke } = setup()
        await invoke({ status: 'paid' })

        expect(issueOriginalInvoiceMock).toHaveBeenCalledTimes(1)
        expect(issueOriginalInvoiceMock.mock.calls[0]![0].folder).toBe('folder-invoices')
    })
})
