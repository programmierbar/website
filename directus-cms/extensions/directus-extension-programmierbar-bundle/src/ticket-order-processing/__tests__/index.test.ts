import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { sendTemplatedEmail } from '../../shared/email-service.ts'
import { generateInvoiceNumber } from '../../shared/invoice-generator.ts'
import { issueOriginalInvoice, markInvoiceSent } from '../../shared/invoice-service.ts'
import { generateUniqueTicketCode } from '../../shared/ticket-utils.ts'
import registerHook from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

jest.mock('../../shared/email-service.ts', () => ({
    sendTemplatedEmail: jest.fn(),
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
}))
jest.mock('../../shared/ticket-utils.ts', () => ({
    generateUniqueTicketCode: jest.fn(),
    formatPrice: (cents: number) => `${(cents / 100).toFixed(2)} €`,
}))

const sendTemplatedEmailMock = jest.mocked(sendTemplatedEmail)
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

const CONFERENCE = { id: 'conf-1', title: 'programmier.con 2026', start_on: '2026-03-01', ticket_max_quantity: null }

function setup(orderOverrides: Record<string, any> = {}) {
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
        env: {},
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
    issueOriginalInvoiceMock.mockReset()
    markInvoiceSentMock.mockReset()
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
        expect(markInvoiceSentMock).toHaveBeenCalledWith(serviceInstances['ticket_invoices']![0], 'doc-1')

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
    })

    test('internal orders: no invoice document, no confirmation email, but profile invitations', async () => {
        const { invoke } = setup({ is_internal: true })
        await invoke({ status: 'paid' })

        expect(issueOriginalInvoiceMock).not.toHaveBeenCalled()
        expect(markInvoiceSentMock).not.toHaveBeenCalled()
        const templates = sendTemplatedEmailMock.mock.calls.map(([opts]) => (opts as any).templateKey)
        expect(templates).toEqual(['ticket_profile_invitation', 'ticket_profile_invitation'])
    })
})
