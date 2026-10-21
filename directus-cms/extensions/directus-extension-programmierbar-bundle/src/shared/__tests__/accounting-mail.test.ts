import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
    buildAccountingMail,
    getAccountingInvoiceEmail,
    resetAccountingMailState,
    sendInvoiceToAccounting,
    type AccountingInvoiceDocument,
} from '../accounting-mail.ts'
import { isSlackConfigured, postSlackMessage } from '../postSlackMessage.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))
jest.mock('../postSlackMessage.ts', () => ({ postSlackMessage: jest.fn(), isSlackConfigured: jest.fn() }))

const postSlackMessageMock = jest.mocked(postSlackMessage)
const isSlackConfiguredMock = jest.mocked(isSlackConfigured)

// The real shared email service runs on top of a fake Directus MailService.
const mailSendMock = jest.fn<(mail: any) => Promise<unknown>>()
class FakeMailService {
    send = mailSendMock
}

const NBSP = ' '

const DOC: AccountingInvoiceDocument = {
    documentKind: 'invoice',
    invoiceNumber: 'PB-CON26-012',
    invoiceDate: new Date(2026, 9, 21),
    snapshot: {
        conference_title: 'programmier.con 2026',
        service_date_start: '2026-11-25',
        service_date_end: '2026-11-26',
        total_gross_cents: 118900,
    },
    pdfBuffer: Buffer.from('%PDF-fake'),
    invoiceFileName: 'Rechnung-PB-CON26-012.pdf',
    orderNumber: 'ORD-2026-ABC123',
}

const CORRECTION: AccountingInvoiceDocument = {
    ...DOC,
    documentKind: 'correction',
    invoiceNumber: 'PB-CON26-049',
    invoiceFileName: 'Rechnungsberichtigung-PB-CON26-049.pdf',
    referenceNumber: 'PB-CON26-040',
    referenceDate: new Date(2026, 9, 1),
}

const CANCELLATION: AccountingInvoiceDocument = {
    ...CORRECTION,
    documentKind: 'cancellation',
    invoiceNumber: 'PB-CON26-050',
    invoiceFileName: 'Stornorechnung-PB-CON26-050.pdf',
    snapshot: { ...DOC.snapshot, total_gross_cents: -118900 },
}

const ENV = { ACCOUNTING_INVOICE_EMAIL: 'accounting@example.test' }

function makeOptions(env: Record<string, unknown> | undefined = ENV) {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const emailContext = {
        logger: logger as any,
        services: { ItemsService: class {}, MailService: FakeMailService },
        getSchema: async () => ({}),
    }
    return { logger, options: { env, emailContext, source: 'test-source' } }
}

beforeEach(() => {
    resetAccountingMailState()
    mailSendMock.mockReset()
    mailSendMock.mockResolvedValue({ messageId: 'x' })
    postSlackMessageMock.mockReset()
    postSlackMessageMock.mockResolvedValue(undefined)
    isSlackConfiguredMock.mockReset()
    isSlackConfiguredMock.mockReturnValue(true)
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
    test('original invoice: classifiable subject and a fact sheet without customer data', () => {
        const mail = buildAccountingMail(DOC)
        expect(mail.subject).toBe('Ausgangsrechnung programmier.con 2026 Ticket – Rechnung PB-CON26-012')
        expect(mail.text).toBe(
            [
                'Dokumentart: Ausgangsrechnung programmier.con 2026 Ticket – Rechnung',
                'Veranstaltung: programmier.con 2026',
                'Rechnungsnummer: PB-CON26-012',
                'Rechnungsdatum: 21.10.2026',
                'Leistungszeitraum: 25.–26.11.2026',
                `Bruttobetrag: 1.189,00${NBSP}€`,
                'Aussteller: Lotum media GmbH',
                '',
                'Das Dokument liegt als PDF bei (Rechnung-PB-CON26-012.pdf).',
                '',
            ].join('\n')
        )
        // No order number either: the body only describes the document.
        expect(mail.text).not.toContain('ORD-2026-ABC123')
    })

    test('correction names the corrected invoice in subject and body', () => {
        const mail = buildAccountingMail(CORRECTION)
        expect(mail.subject).toBe(
            'Ausgangsrechnung programmier.con 2026 Ticket – Rechnungsberichtigung PB-CON26-049 zu PB-CON26-040'
        )
        expect(mail.text).toContain(
            'Dokumentart: Ausgangsrechnung programmier.con 2026 Ticket – Rechnungsberichtigung\n'
        )
        expect(mail.text).toContain('Bezug auf Originalrechnung: PB-CON26-040 vom 01.10.2026\n')
    })

    test('cancellation is marked as Gutschrift with a negative amount', () => {
        const mail = buildAccountingMail(CANCELLATION)
        expect(mail.subject).toBe(
            'Ausgangsrechnung programmier.con 2026 Ticket – Stornorechnung (Gutschrift) PB-CON26-050 zu PB-CON26-040'
        )
        expect(mail.text).toContain(
            'Dokumentart: Ausgangsrechnung programmier.con 2026 Ticket – Stornorechnung (Gutschrift)\n'
        )
        expect(mail.text).toContain(`Bruttobetrag: -1.189,00${NBSP}€\n`)
        expect(mail.text).toContain('Bezug auf Originalrechnung: PB-CON26-040 vom 01.10.2026\n')
    })

    test('a replacement version is marked in subject and body', () => {
        const mail = buildAccountingMail({ ...DOC, replacesPreviousVersion: true })
        expect(mail.subject).toBe(
            'Ausgangsrechnung programmier.con 2026 Ticket – Rechnung PB-CON26-012 (ersetzt vorherige Fassung)'
        )
        expect(mail.text).toContain('Diese Fassung ersetzt die zuvor übermittelte mit derselben Rechnungsnummer.')
    })

    test('omits what is not known: conference title, Leistungszeitraum, reference date', () => {
        const mail = buildAccountingMail({
            ...CORRECTION,
            referenceDate: null,
            snapshot: { conference_title: '', service_date_start: null, service_date_end: null, total_gross_cents: 0 },
        })
        expect(mail.subject).toBe('Ausgangsrechnung Ticket – Rechnungsberichtigung PB-CON26-049 zu PB-CON26-040')
        expect(mail.text).not.toContain('Veranstaltung')
        expect(mail.text).not.toContain('Leistungszeitraum')
        expect(mail.text).toContain('Bezug auf Originalrechnung: PB-CON26-040\n')
    })
})

describe('sendInvoiceToAccounting', () => {
    test('sends one plain-text mail with exactly the document PDF through the MailService', async () => {
        const { options } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('sent')

        expect(mailSendMock).toHaveBeenCalledTimes(1)
        const mail = mailSendMock.mock.calls[0]![0]
        const expected = buildAccountingMail(DOC)
        // No `from`: the MailService uses EMAIL_FROM like for every other mail.
        expect(mail).toEqual({
            to: 'accounting@example.test',
            subject: expected.subject,
            text: expected.text,
            attachments: [
                { filename: 'Rechnung-PB-CON26-012.pdf', content: DOC.pdfBuffer, contentType: 'application/pdf' },
            ],
        })
        expect(mail.attachments[0].content).toBe(DOC.pdfBuffer) // the very same bytes
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('retries a failed send and recovers without escalating', async () => {
        mailSendMock.mockRejectedValueOnce(new Error('421 try again')).mockResolvedValueOnce({ messageId: 'x' })
        const { options } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('sent')

        expect(mailSendMock).toHaveBeenCalledTimes(2)
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('persistent failure: alerts Slack with the invoice number and does not throw', async () => {
        mailSendMock.mockRejectedValue(new Error('transport down'))
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(mailSendMock).toHaveBeenCalledTimes(3)
        expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('transport down')
        expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
        const slack = postSlackMessageMock.mock.calls[0]![0]
        expect(slack).toContain('PB-CON26-012')
        expect(slack).toContain('ORD-2026-ABC123')
        expect(slack).toContain('Rechnung-PB-CON26-012.pdf')
        // The address is configuration, not something to broadcast.
        expect(slack).not.toContain('accounting@example.test')
    })

    test('a failing Slack alert is swallowed too', async () => {
        mailSendMock.mockRejectedValue(new Error('transport down'))
        postSlackMessageMock.mockRejectedValue(new Error('slack down'))
        const { options, logger } = makeOptions()
        await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('failed')

        expect(mailSendMock).toHaveBeenCalledTimes(3)
        expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('slack down')
    })

    describe('mailbox not configured', () => {
        afterEach(() => {
            expect(mailSendMock).not.toHaveBeenCalled()
        })

        test('skips every document with an info log and alerts Slack once per process', async () => {
            const { options, logger } = makeOptions({})
            await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('skipped')
            await expect(sendInvoiceToAccounting(CORRECTION, options)).resolves.toBe('skipped')

            expect(logger.info).toHaveBeenCalledTimes(2)
            expect(logger.info.mock.calls[0]![0]).toContain('ACCOUNTING_INVOICE_EMAIL')
            expect(logger.info.mock.calls[1]![0]).toContain('PB-CON26-049')
            expect(logger.error).not.toHaveBeenCalled()

            expect(postSlackMessageMock).toHaveBeenCalledTimes(1)
            const slack = postSlackMessageMock.mock.calls[0]![0]
            expect(slack).toContain('ACCOUNTING_INVOICE_EMAIL')
            expect(slack).toContain('PB-CON26-012')
        })

        test('an undelivered alert is retried with the next document', async () => {
            postSlackMessageMock.mockRejectedValueOnce(new Error('slack down'))
            const { options, logger } = makeOptions({})
            await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('skipped')
            await expect(sendInvoiceToAccounting(CORRECTION, options)).resolves.toBe('skipped')
            await expect(sendInvoiceToAccounting(CANCELLATION, options)).resolves.toBe('skipped')

            expect(postSlackMessageMock).toHaveBeenCalledTimes(2)
            expect(postSlackMessageMock.mock.calls[1]![0]).toContain('PB-CON26-049')
            expect(logger.error.mock.calls.map((c) => c[0]).join('\n')).toContain('slack down')
        })

        test('stays quiet when Slack is not configured', async () => {
            isSlackConfiguredMock.mockReturnValue(false)
            const { options, logger } = makeOptions({ ACCOUNTING_INVOICE_EMAIL: '' })
            await expect(sendInvoiceToAccounting(DOC, options)).resolves.toBe('skipped')

            expect(postSlackMessageMock).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })
    })
})
