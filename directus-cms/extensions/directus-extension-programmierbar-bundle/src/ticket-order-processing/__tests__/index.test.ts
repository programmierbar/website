import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { resetAccountingMailState } from '../../shared/accounting-mail.ts'
import { sendRawEmail, sendTemplatedEmail } from '../../shared/email-service.ts'
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
    sendTemplatedEmail: jest.fn(),
    sendRawEmail: jest.fn(),
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
    // Used by the (real) accounting-mail helper for the mail subject.
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

// The accounting copy goes through its own SMTP transport, never through MailService.
const mockSendMail = jest.fn<(mail: any) => Promise<unknown>>()
jest.mock('nodemailer', () => ({
    __esModule: true,
    default: { createTransport: jest.fn(() => ({ sendMail: mockSendMail })) },
}))

const sendTemplatedEmailMock = jest.mocked(sendTemplatedEmail)
const sendRawEmailMock = jest.mocked(sendRawEmail)
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

const ACCOUNTING_ENV = {
    ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test',
    ACCOUNTING_SMTP_HOST: 'smtp.example.test',
    ACCOUNTING_SMTP_PORT: 465,
    ACCOUNTING_SMTP_SECURE: true,
    ACCOUNTING_SMTP_USER: 'sender@example.test',
    ACCOUNTING_SMTP_PASSWORD: 'app-password',
    ACCOUNTING_MAIL_FROM: 'sender@example.test',
}

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

    return { order, serviceInstances, actions, invoke, logger }
}

beforeEach(() => {
    sendTemplatedEmailMock.mockReset()
    sendRawEmailMock.mockReset()
    mockSendMail.mockReset()
    resetAccountingMailState()
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
        snapshot: {} as any,
    })
    sendTemplatedEmailMock.mockResolvedValue(true)
    mockSendMail.mockResolvedValue({ messageId: 'x' })
})

describe('ticket-order-processing hook', () => {
    test('does nothing when the status is not being set to paid', async () => {
        const { invoke, serviceInstances } = setup()
        await invoke({ status: 'cancelled' })

        expect(issueOriginalInvoiceMock).not.toHaveBeenCalled()
        expect(sendTemplatedEmailMock).not.toHaveBeenCalled()
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
        expect(issueParams.servicePeriod).toMatchObject({ start_on: '2026-03-01', end_on: '2026-03-02' })
        expect(issueParams.invoicesService).toBe(serviceInstances['ticket_invoices']![0])

        // The confirmation email carries the invoice PDF.
        const confirmation = sendTemplatedEmailMock.mock.calls.find(
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
        const invitations = sendTemplatedEmailMock.mock.calls.filter(
            ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
        )
        expect(invitations).toHaveLength(2)

        // Tickets were created for both attendees.
        expect(serviceInstances['tickets']![0].createOne).toHaveBeenCalledTimes(2)
    })

    test('does NOT mark the invoice as sent when the confirmation email fails', async () => {
        sendTemplatedEmailMock.mockResolvedValue(false)
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
        const invitations = sendTemplatedEmailMock.mock.calls.filter(
            ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
        )
        expect(invitations).toHaveLength(2)
    })

    test('a failing Slack escalation is swallowed and the hook still completes', async () => {
        markInvoiceSentMock.mockRejectedValue(new Error('db down'))
        postSlackMessageMock.mockRejectedValue(new Error('slack down'))
        const { invoke } = setup()
        await invoke({ status: 'paid' })

        const invitations = sendTemplatedEmailMock.mock.calls.filter(
            ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
        )
        expect(invitations).toHaveLength(2)
    })

    test('internal orders: no invoice document, no confirmation email, but profile invitations', async () => {
        const { invoke } = setup({ is_internal: true })
        await invoke({ status: 'paid' })

        expect(issueOriginalInvoiceMock).not.toHaveBeenCalled()
        expect(markInvoiceSentMock).not.toHaveBeenCalled()
        const templates = sendTemplatedEmailMock.mock.calls.map(([opts]) => (opts as any).templateKey)
        expect(templates).toEqual(['ticket_profile_invitation', 'ticket_profile_invitation'])
    })

    describe('accounting copy', () => {
        const invitations = () =>
            sendTemplatedEmailMock.mock.calls.filter(
                ([opts]) => (opts as any).templateKey === 'ticket_profile_invitation'
            )

        test('mails the original invoice PDF to the accounting mailbox as a separate mail', async () => {
            const { invoke } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(mockSendMail).toHaveBeenCalledTimes(1)
            const mail = mockSendMail.mock.calls[0]![0]
            expect(mail.to).toBe('accounting@example.test')
            // Registered sender as header AND envelope sender, over the dedicated transport.
            expect(mail.from).toBe('sender@example.test')
            expect(mail.envelope).toEqual({ from: 'sender@example.test', to: 'accounting@example.test' })
            expect(sendRawEmailMock).not.toHaveBeenCalled()
            expect(mail.subject).toBe('Rechnung PB-CON26-001')
            expect(mail.text).toContain('ORD-2026-ABC123')
            expect(mail.html).toBeUndefined() // plain text, not the customer template
            // Exactly the generated document: same bytes, same file name, one per mail.
            expect(mail.attachments).toEqual([
                {
                    filename: 'Rechnung-PB-CON26-001.pdf',
                    content: Buffer.from('%PDF-fake'),
                    contentType: 'application/pdf',
                },
            ])

            // Not piggybacked onto the customer mail.
            const confirmation = sendTemplatedEmailMock.mock.calls.find(
                ([options]) => (options as any).templateKey === 'ticket_order_confirmation'
            )![0] as any
            expect(confirmation.cc).toBeUndefined()
            expect(confirmation.bcc).toBeUndefined()
        })

        test('is sent even when the customer confirmation mail fails — and never stamps sent_at', async () => {
            sendTemplatedEmailMock.mockResolvedValue(false)
            const { invoke } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(mockSendMail).toHaveBeenCalledTimes(1)
            expect(mockSendMail.mock.calls[0]![0].subject).toBe('Rechnung PB-CON26-001')
            expect(markInvoiceSentMock).not.toHaveBeenCalled()
        })

        test('is skipped with an info log when ACCOUNTING_INVOICE_EMAIL is not set', async () => {
            const { invoke, logger } = setup({}, { ACCOUNTING_INVOICE_EMAIL: '' })
            await invoke({ status: 'paid' })

            expect(mockSendMail).not.toHaveBeenCalled()
            const skipLogs = logger.info.mock.calls
                .map((call) => String(call[0]))
                .filter((msg) => msg.includes('ACCOUNTING_INVOICE_EMAIL'))
            expect(skipLogs).toHaveLength(1)
            expect(skipLogs[0]).toContain('PB-CON26-001')
            expect(logger.error).not.toHaveBeenCalled()
            // Customer flow is unaffected.
            expect(markInvoiceSentMock).toHaveBeenCalledTimes(1)
        })

        test('persistent failure: retried, escalated to Slack with the invoice number, hook carries on', async () => {
            mockSendMail.mockRejectedValue(new Error('550 sender rejected'))
            const { invoke } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(mockSendMail).toHaveBeenCalledTimes(3)
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(postSlackMessageMock.mock.calls[0]![0]).toContain('PB-CON26-001')
            expect(postSlackMessageMock.mock.calls[0]![0]).toContain('ORD-2026-ABC123')

            // The customer still got their invoice, issuance is recorded from THAT mail,
            // tickets exist and attendees were invited.
            expect(markInvoiceSentMock).toHaveBeenCalledTimes(1)
            expect(invitations()).toHaveLength(2)
        })

        test('a throwing mail transport does not break order processing either', async () => {
            mockSendMail.mockRejectedValue(new Error('smtp exploded'))
            postSlackMessageMock.mockRejectedValue(new Error('slack down'))
            const { invoke } = setup({}, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(mockSendMail).toHaveBeenCalledTimes(3)
            expect(markInvoiceSentMock).toHaveBeenCalledTimes(1)
            expect(invitations()).toHaveLength(2)
        })

        test('incomplete SMTP config: no mail, warning and Slack alert, order processing unaffected', async () => {
            const { ACCOUNTING_MAIL_FROM: _unused, ...env } = ACCOUNTING_ENV
            const { invoke, logger } = setup({}, env)
            await invoke({ status: 'paid' })

            expect(mockSendMail).not.toHaveBeenCalled()
            expect(sendRawEmailMock).not.toHaveBeenCalled() // no fallback to MailService
            expect(logger.warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('ACCOUNTING_MAIL_FROM')
            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            expect(postSlackMessageMock.mock.calls[0]![0]).toContain('ACCOUNTING_MAIL_FROM')
            expect(markInvoiceSentMock).toHaveBeenCalledTimes(1)
            expect(invitations()).toHaveLength(2)
        })

        test('internal orders have no invoice, so nothing goes to accounting', async () => {
            const { invoke } = setup({ is_internal: true }, ACCOUNTING_ENV)
            await invoke({ status: 'paid' })

            expect(mockSendMail).not.toHaveBeenCalled()
            expect(postSlackMessageMock).not.toHaveBeenCalled()
        })
    })
})
