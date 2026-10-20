import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import nodemailer from 'nodemailer'
import {
    buildAccountingMail,
    getAccountingInvoiceEmail,
    getAccountingSmtpConfig,
    resetAccountingMailState,
    sendInvoiceToAccounting,
    type AccountingInvoiceDocument,
} from '../accounting-mail.ts'
import { postSlackMessage } from '../postSlackMessage.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))
jest.mock('../postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))
const mockSendMail = jest.fn<(mail: any) => Promise<unknown>>()
jest.mock('nodemailer', () => ({
    __esModule: true,
    default: { createTransport: jest.fn(() => ({ sendMail: mockSendMail })) },
}))

const createTransportMock = jest.mocked(nodemailer.createTransport)
const postSlackMessageMock = jest.mocked(postSlackMessage)

const DOC: AccountingInvoiceDocument = {
    documentKind: 'invoice',
    invoiceNumber: 'PB-CON26-001',
    pdfBuffer: Buffer.from('%PDF-fake'),
    invoiceFileName: 'Rechnung-PB-CON26-001.pdf',
    orderNumber: 'ORD-2026-ABC123',
}

const ENV = {
    ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test',
    ACCOUNTING_SMTP_HOST: 'smtp.example.test',
    ACCOUNTING_SMTP_PORT: '587',
    ACCOUNTING_SMTP_SECURE: 'false',
    ACCOUNTING_SMTP_USER: 'sender@example.test',
    ACCOUNTING_SMTP_PASSWORD: 'app-password',
    ACCOUNTING_MAIL_FROM: 'sender@example.test',
}

function makeOptions(env: Record<string, unknown> | undefined = ENV) {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    return { logger, options: { env, logger, source: 'test-source' } }
}

beforeEach(() => {
    resetAccountingMailState()
    createTransportMock.mockClear()
    mockSendMail.mockReset()
    mockSendMail.mockResolvedValue({ messageId: 'x' })
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

describe('getAccountingSmtpConfig', () => {
    test('reads the dedicated transport from env, accepting Directus-cast values', () => {
        expect(getAccountingSmtpConfig({ ...ENV, ACCOUNTING_SMTP_PORT: 465, ACCOUNTING_SMTP_SECURE: true })).toEqual({
            config: {
                host: 'smtp.example.test',
                port: 465,
                secure: true,
                user: 'sender@example.test',
                password: 'app-password',
                from: 'sender@example.test',
            },
            missing: [],
        })
    })

    test.each([
        [465, true],
        [587, false],
    ])('derives secure from port %s when ACCOUNTING_SMTP_SECURE is unset', (port, secure) => {
        const { ACCOUNTING_SMTP_SECURE: _unused, ...env } = ENV
        expect(getAccountingSmtpConfig({ ...env, ACCOUNTING_SMTP_PORT: String(port) }).config?.secure).toBe(secure)
    })

    test('names every missing or invalid variable', () => {
        const result = getAccountingSmtpConfig({
            ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test',
            ACCOUNTING_SMTP_HOST: 'smtp.example.test',
            ACCOUNTING_SMTP_PORT: 'abc',
            ACCOUNTING_SMTP_PASSWORD: '',
        })
        expect(result.config).toBeNull()
        expect([...result.missing].sort()).toEqual([
            'ACCOUNTING_MAIL_FROM',
            'ACCOUNTING_SMTP_PASSWORD',
            'ACCOUNTING_SMTP_PORT',
            'ACCOUNTING_SMTP_USER',
        ])
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
    test('sends one plain-text mail with exactly the document PDF over the dedicated SMTP transport', async () => {
        const { options } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('sent')

        // Transport built from the ACCOUNTING_SMTP_* env, STARTTLS enforced on 587.
        expect(createTransportMock).toHaveBeenCalledTimes(1)
        expect(createTransportMock).toHaveBeenCalledWith({
            host: 'smtp.example.test',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: { user: 'sender@example.test', pass: 'app-password' },
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const mail = mockSendMail.mock.calls[0]![0]
        expect(mail).toEqual({
            from: 'sender@example.test',
            to: 'accounting@example.test',
            // The mailbox checks MAIL FROM against the registered sender.
            envelope: { from: 'sender@example.test', to: 'accounting@example.test' },
            subject: 'Rechnung PB-CON26-001',
            text: 'Rechnung PB-CON26-001 (Bestellung ORD-2026-ABC123) im Anhang.\n',
            attachments: [
                { filename: 'Rechnung-PB-CON26-001.pdf', content: DOC.pdfBuffer, contentType: 'application/pdf' },
            ],
        })
        expect(mail.attachments[0].content).toBe(DOC.pdfBuffer) // the very same bytes
        // The upload mailbox rejects HTML, links and images.
        expect(mail).not.toHaveProperty('html')
        expect(mail.text).not.toMatch(/https?:|www\./)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('creates the transport once and reuses it', async () => {
        const { options } = makeOptions()
        await sendInvoiceToAccounting(DOC, options)
        await sendInvoiceToAccounting({ ...DOC, invoiceNumber: 'PB-CON26-002' }, options)

        expect(createTransportMock).toHaveBeenCalledTimes(1)
        expect(mockSendMail).toHaveBeenCalledTimes(2)
    })

    test('skips with one info log (no error) when the mailbox is not configured', async () => {
        const { options, logger } = makeOptions({})
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('skipped')

        expect(createTransportMock).not.toHaveBeenCalled()
        expect(mockSendMail).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledTimes(1)
        expect(logger.info.mock.calls[0]![0]).toContain('ACCOUNTING_INVOICE_EMAIL')
        expect(logger.info.mock.calls[0]![0]).toContain('PB-CON26-001')
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('incomplete SMTP config: skips with a warning per document and alerts Slack once per process', async () => {
        const { ACCOUNTING_SMTP_PASSWORD: _unused, ...env } = ENV
        const { options, logger } = makeOptions(env)

        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('misconfigured')
        await expect(sendInvoiceToAccounting({ ...DOC, invoiceNumber: 'PB-CON26-002' }, options)).resolves.toBe(
            'misconfigured'
        )

        // No mail through any transport — in particular no fallback that would bounce.
        expect(createTransportMock).not.toHaveBeenCalled()
        expect(mockSendMail).not.toHaveBeenCalled()

        expect(logger.warn).toHaveBeenCalledTimes(2)
        expect(logger.warn.mock.calls[0]![0]).toContain('ACCOUNTING_SMTP_PASSWORD')
        expect(logger.warn.mock.calls[1]![0]).toContain('PB-CON26-002')

        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const slack = postSlackMessageMock.mock.calls[0]![0]
        expect(slack).toContain('ACCOUNTING_SMTP_PASSWORD')
        expect(slack).toContain('PB-CON26-001')
        expect(slack).not.toContain('accounting@example.test')
    })

    test('retries a failed send and recovers without escalating', async () => {
        mockSendMail.mockRejectedValueOnce(new Error('421 try again')).mockResolvedValueOnce({ messageId: 'x' })
        const { options } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('sent')

        expect(mockSendMail).toHaveBeenCalledTimes(2)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('persistent failure: alerts Slack with the invoice number and does not throw', async () => {
        mockSendMail.mockRejectedValue(new Error('550 sender not registered'))
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(mockSendMail).toHaveBeenCalledTimes(3)
        expect(logger.warn.mock.calls.map((c) => c[0]).join('\n')).toContain('550 sender not registered')
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const slack = postSlackMessageMock.mock.calls[0]![0]
        expect(slack).toContain('PB-CON26-001')
        expect(slack).toContain('ORD-2026-ABC123')
        expect(slack).toContain('Rechnung-PB-CON26-001.pdf')
        // The address is configuration, not something to broadcast.
        expect(slack).not.toContain('accounting@example.test')
        expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('PB-CON26-001')
    })

    test('a failing Slack alert is swallowed too', async () => {
        mockSendMail.mockRejectedValue(new Error('smtp exploded'))
        postSlackMessageMock.mockRejectedValue(new Error('slack down'))
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(mockSendMail).toHaveBeenCalledTimes(3)
        expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('slack down')
    })

    test('a transport that cannot be created is retried, alerted and does not throw', async () => {
        createTransportMock.mockImplementation(() => {
            throw new Error('bad transport options')
        })
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(createTransportMock).toHaveBeenCalledTimes(3)
        expect(logger.warn.mock.calls.map((c) => c[0]).join('\n')).toContain('bad transport options')
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        createTransportMock.mockImplementation(() => ({ sendMail: mockSendMail }) as any)
    })
})
