import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
    buildAccountingMail,
    getAccountingInvoiceEmail,
    sendInvoiceToAccounting,
    type AccountingInvoiceDocument,
} from '../accounting-mail.ts'
import { sendRawEmail } from '../email-service.ts'
import { postSlackMessage } from '../postSlackMessage.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))
jest.mock('../email-service.ts', () => ({ sendRawEmail: jest.fn() }))
jest.mock('../postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))

const sendRawEmailMock = jest.mocked(sendRawEmail)
const postSlackMessageMock = jest.mocked(postSlackMessage)

const DOC: AccountingInvoiceDocument = {
    documentKind: 'invoice',
    invoiceNumber: 'PB-CON26-001',
    pdfBuffer: Buffer.from('%PDF-fake'),
    invoiceFileName: 'Rechnung-PB-CON26-001.pdf',
    orderNumber: 'ORD-2026-ABC123',
}

const ENV = { ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test' }

function makeOptions(env: Record<string, unknown> | undefined = ENV) {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    return {
        logger,
        options: {
            env,
            emailContext: { logger: logger as any, services: {} as any, getSchema: async () => ({}) },
            source: 'test-source',
        },
    }
}

beforeEach(() => {
    sendRawEmailMock.mockReset()
    sendRawEmailMock.mockResolvedValue(true)
    postSlackMessageMock.mockReset()
})

describe('getAccountingInvoiceEmail', () => {
    test.each([
        ['unset', {}],
        ['empty', { ACCOUNTING_INVOICE_EMAIL: '' }],
        ['whitespace', { ACCOUNTING_INVOICE_EMAIL: '   ' }],
        ['not a string', { ACCOUNTING_INVOICE_EMAIL: true }],
        ['no env at all', undefined],
    ])('returns null when %s', (_label, env) => {
        expect(getAccountingInvoiceEmail(env as any)).toBeNull()
    })

    test('returns the trimmed address', () => {
        expect(getAccountingInvoiceEmail({ ACCOUNTING_INVOICE_EMAIL: ' accounting@example.test ' })).toBe(
            'accounting@example.test'
        )
    })
})

describe('buildAccountingMail', () => {
    test('original invoice: minimal subject, one-line body', () => {
        const mail = buildAccountingMail(DOC)
        expect(mail.subject).toBe('Rechnung PB-CON26-001')
        expect(mail.text).toBe('Rechnung PB-CON26-001 (Bestellung ORD-2026-ABC123) im Anhang.\n')
    })

    test('correction and cancellation name their document type and the referenced invoice', () => {
        const correction = buildAccountingMail({
            ...DOC,
            documentKind: 'correction',
            invoiceNumber: 'PB-CON26-002',
            referenceNumber: 'PB-CON26-001',
        })
        expect(correction.subject).toBe('Rechnungsberichtigung PB-CON26-002')
        expect(correction.text).toContain('zu Rechnung PB-CON26-001')

        const cancellation = buildAccountingMail({
            ...DOC,
            documentKind: 'cancellation',
            invoiceNumber: 'PB-CON26-003',
        })
        expect(cancellation.subject).toBe('Stornorechnung PB-CON26-003')
    })

    test('a replacement version is marked in the subject', () => {
        const mail = buildAccountingMail({ ...DOC, replacesPreviousVersion: true })
        expect(mail.subject).toBe('Rechnung PB-CON26-001 (ersetzt vorherige Fassung)')
        expect(mail.text).toContain('ersetzt')
    })
})

describe('sendInvoiceToAccounting', () => {
    test('sends one plain-text mail with exactly the document PDF attached', async () => {
        const { options } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('sent')

        expect(sendRawEmailMock).toHaveBeenCalledTimes(1)
        const [mail, emailContext] = sendRawEmailMock.mock.calls[0]!
        expect(mail).toEqual({
            to: 'accounting@example.test',
            subject: 'Rechnung PB-CON26-001',
            text: 'Rechnung PB-CON26-001 (Bestellung ORD-2026-ABC123) im Anhang.\n',
            attachments: [
                { filename: 'Rechnung-PB-CON26-001.pdf', content: DOC.pdfBuffer, contentType: 'application/pdf' },
            ],
        })
        expect(mail.attachments![0]!.content).toBe(DOC.pdfBuffer) // the very same bytes
        // The upload mailbox rejects HTML/links/images and checks the sender: plain text
        // only, and no from/sender/envelope override of the configured EMAIL_FROM.
        expect(mail).not.toHaveProperty('html')
        expect(mail).not.toHaveProperty('from')
        expect(mail).not.toHaveProperty('sender')
        expect(mail).not.toHaveProperty('envelope')
        expect(mail.text).not.toMatch(/https?:|www\./)
        expect(emailContext).toBe(options.emailContext)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('skips with one info log (no error) when the mailbox is not configured', async () => {
        const { options, logger } = makeOptions({})
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('skipped')

        expect(sendRawEmailMock).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledTimes(1)
        expect(logger.info.mock.calls[0]![0]).toContain('ACCOUNTING_INVOICE_EMAIL')
        expect(logger.info.mock.calls[0]![0]).toContain('PB-CON26-001')
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    test('retries a failed send and recovers without escalating', async () => {
        sendRawEmailMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        const { options } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('sent')

        expect(sendRawEmailMock).toHaveBeenCalledTimes(2)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('persistent failure: alerts Slack with the invoice number and does not throw', async () => {
        sendRawEmailMock.mockResolvedValue(false)
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(sendRawEmailMock).toHaveBeenCalledTimes(3)
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const slack = postSlackMessageMock.mock.calls[0]![0]
        expect(slack).toContain('PB-CON26-001')
        expect(slack).toContain('ORD-2026-ABC123')
        expect(slack).toContain('Rechnung-PB-CON26-001.pdf')
        // The address is configuration, not something to broadcast.
        expect(slack).not.toContain('accounting@example.test')
        expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('PB-CON26-001')
    })

    test('a throwing transport and a failing Slack alert are both swallowed', async () => {
        sendRawEmailMock.mockRejectedValue(new Error('smtp exploded'))
        postSlackMessageMock.mockRejectedValue(new Error('slack down'))
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(sendRawEmailMock).toHaveBeenCalledTimes(3)
        expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('slack down')
    })
})
