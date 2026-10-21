/**
 * Accounting copy of every invoice document.
 *
 * Each generated invoice document (Rechnung, Rechnungsberichtigung, Stornorechnung) is
 * mailed to the accounting mailbox, one PDF per mail, so it is recorded in the books
 * promptly (GoBD). Accounting takes it from there into the bookkeeping system. This is a
 * separate mail — never a BCC on the customer mail — and is independent of whether the
 * customer mail went out: the document exists either way.
 *
 * It goes through the Directus MailService like every other mail (shared email service,
 * sender `EMAIL_FROM`). Subject and plain-text body state what the document is
 * (Ausgangsrechnung, document type, number, reference, amount) so it can be classified
 * without opening the PDF. The body carries no customer data — the PDF has everything.
 *
 * The mailbox comes from `ACCOUNTING_INVOICE_EMAIL`. Without it the accounting copy is
 * skipped (info log, plus one Slack alert per process so a missing production setting
 * does not go unnoticed), and environments without bookkeeping keep working unchanged.
 */

import { sendRawEmail, type EmailServiceContext } from './email-service.js'
import { INVOICE_ISSUER_NAME, type InvoiceDocumentKind } from './invoice-generator.js'
import {
    formatInvoiceDate,
    formatServiceDate,
    INVOICE_DOCUMENT_LABEL,
    type InvoiceSnapshot,
} from './invoice-service.js'
import { isSlackConfigured, postSlackMessage } from './postSlackMessage.js'
import { formatPrice } from './ticket-utils.js'

export const ACCOUNTING_INVOICE_EMAIL_ENV = 'ACCOUNTING_INVOICE_EMAIL'

/** How often to attempt sending the accounting copy before escalating to Slack. */
export const ACCOUNTING_MAIL_ATTEMPTS = 3

/** Document type as named in the accounting mail (more specific than the PDF title). */
export const ACCOUNTING_DOCUMENT_LABEL: Record<InvoiceDocumentKind, string> = {
    invoice: 'Ticketrechnung',
    correction: 'Rechnungsberichtigung',
    cancellation: 'Stornorechnung (Gutschrift)',
}

export interface AccountingInvoiceDocument {
    documentKind: InvoiceDocumentKind
    invoiceNumber: string
    invoiceDate: Date
    /** The snapshot the PDF was rendered from (conference, Leistungsdatum, gross amount). */
    snapshot: Pick<
        InvoiceSnapshot,
        'conference_title' | 'service_date_start' | 'service_date_end' | 'total_gross_cents'
    >
    /** The exact bytes of the stored PDF. */
    pdfBuffer: Buffer
    /** Same file name as the stored PDF, e.g. `Rechnung-PB-CON26-001.pdf`. */
    invoiceFileName: string
    /** For logs and the Slack alert only — not part of the mail. */
    orderNumber?: string | null
    /** The corrected/cancelled invoice (corrections and cancellations only). */
    referenceNumber?: string | null
    referenceDate?: Date | null
    /**
     * The document was re-rendered under the same number (pre-issuance regenerate), so
     * accounting may already hold an earlier version that this one replaces.
     */
    replacesPreviousVersion?: boolean
}

export type AccountingMailResult = 'sent' | 'skipped' | 'failed'

export interface AccountingMailOptions {
    /** The extension's env (hook/endpoint context `env`). */
    env: Record<string, unknown> | undefined
    /** Mail goes through the shared email service; its logger is used for all logs. */
    emailContext: EmailServiceContext
    /** Hook or endpoint name, for logs and Slack alerts. */
    source: string
}

/** The configured accounting mailbox, or null when the env var is unset or empty. */
export function getAccountingInvoiceEmail(env: Record<string, unknown> | undefined): string | null {
    const value = env?.[ACCOUNTING_INVOICE_EMAIL_ENV]
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

// Process-wide: alert Slack about a missing mailbox once (again after a failed post).
let missingMailboxReported = false

/** Reset the once-per-process alert flag (tests only). */
export function resetAccountingMailState(): void {
    missingMailboxReported = false
}

/** Subject and plain-text body that identify the document for automatic classification. */
export function buildAccountingMail(doc: AccountingInvoiceDocument): { subject: string; text: string } {
    const conference = doc.snapshot.conference_title?.trim()
    const label = ACCOUNTING_DOCUMENT_LABEL[doc.documentKind]
    const reference = doc.referenceNumber ? ` zu ${doc.referenceNumber}` : ''
    const replaces = doc.replacesPreviousVersion ? ' (ersetzt vorherige Fassung)' : ''
    const subject = `Ausgangsrechnung${conference ? ` ${conference}` : ''} – ${label} ${doc.invoiceNumber}${reference}${replaces}`

    const serviceDate = formatServiceDate(doc.snapshot.service_date_start, doc.snapshot.service_date_end)
    const lines = [
        `Dokumentart: Ausgangsrechnung – ${label}`,
        ...(conference ? [`Veranstaltung: ${conference}`] : []),
        `Rechnungsnummer: ${doc.invoiceNumber}`,
        `Rechnungsdatum: ${formatInvoiceDate(doc.invoiceDate)}`,
        ...(serviceDate ? [`Leistungszeitraum: ${serviceDate}`] : []),
        ...(doc.referenceNumber
            ? [
                  `Bezug auf Originalrechnung: ${doc.referenceNumber}${doc.referenceDate ? ` vom ${formatInvoiceDate(doc.referenceDate)}` : ''}`,
              ]
            : []),
        `Bruttobetrag: ${formatPrice(doc.snapshot.total_gross_cents)}`,
        `Aussteller: ${INVOICE_ISSUER_NAME}`,
        '',
        `Das Dokument liegt als PDF bei (${doc.invoiceFileName}).`,
    ]
    if (doc.replacesPreviousVersion) {
        lines.push('Diese Fassung ersetzt die zuvor übermittelte mit derselben Rechnungsnummer.')
    }

    return { subject, text: `${lines.join('\n')}\n` }
}

/**
 * Mail the document to the accounting mailbox. Never throws: a failing accounting copy
 * must not fail order processing or a lifecycle operation. Retries a few times and, on
 * persistent failure, alerts Slack with the invoice number so a human forwards the PDF.
 *
 * Deliberately does not touch `sent_at` — that records the customer dispatch only.
 */
export async function sendInvoiceToAccounting(
    doc: AccountingInvoiceDocument,
    options: AccountingMailOptions
): Promise<AccountingMailResult> {
    const { emailContext, source } = options
    const { logger } = emailContext
    const label = INVOICE_DOCUMENT_LABEL[doc.documentKind]
    const order = doc.orderNumber ? ` zu Bestellung ${doc.orderNumber}` : ''

    try {
        const to = getAccountingInvoiceEmail(options.env)
        if (!to) {
            logger.info(
                `${source}: ${ACCOUNTING_INVOICE_EMAIL_ENV} is not set — skipping accounting copy of ${doc.invoiceNumber}`
            )
            if (!missingMailboxReported && isSlackConfigured()) {
                missingMailboxReported = true
                try {
                    await postSlackMessage(
                        `:warning: *${source}*: ${ACCOUNTING_INVOICE_EMAIL_ENV} ist nicht gesetzt — Rechnungsdokumente gehen nicht an die Buchhaltung. Erstes betroffenes Dokument: ${label} ${doc.invoiceNumber}${order}. Falls diese Umgebung Rechnungen für die Buchhaltung erzeugt: Variable setzen, Directus neu starten und die seitdem erzeugten PDFs manuell weiterleiten (das Directus-Log nennt jede Nummer). Dieser Hinweis kommt einmal pro Prozessstart.`
                    )
                } catch (slackErr: any) {
                    // Not delivered: let the next document try again.
                    missingMailboxReported = false
                    logger.error(`${source}: Failed to send Slack notification: ${slackErr?.message || slackErr}`)
                }
            }
            return 'skipped'
        }

        const { subject, text } = buildAccountingMail(doc)
        for (let attempt = 1; attempt <= ACCOUNTING_MAIL_ATTEMPTS; attempt++) {
            // sendRawEmail never throws; it logs the transport error itself.
            const sent = await sendRawEmail(
                {
                    to,
                    subject,
                    text,
                    attachments: [
                        { filename: doc.invoiceFileName, content: doc.pdfBuffer, contentType: 'application/pdf' },
                    ],
                },
                emailContext
            )
            if (sent) {
                logger.info(`${source}: Sent accounting copy of ${doc.invoiceNumber}`)
                return 'sent'
            }
            logger.warn(
                `${source}: Attempt ${attempt}/${ACCOUNTING_MAIL_ATTEMPTS} to send the accounting copy of ${doc.invoiceNumber} failed`
            )
        }

        logger.error(
            `${source}: Accounting copy of ${label} ${doc.invoiceNumber}${order} could not be sent after ${ACCOUNTING_MAIL_ATTEMPTS} attempts`
        )
        try {
            await postSlackMessage(
                `:warning: *${source}*: ${label} ${doc.invoiceNumber}${order} konnte nach ${ACCOUNTING_MAIL_ATTEMPTS} Versuchen nicht an das Buchhaltungspostfach geschickt werden. Bitte das PDF (${doc.invoiceFileName}) aus Directus manuell an die Buchhaltung weiterleiten. Details im Directus-Log.`
            )
        } catch (slackErr: any) {
            logger.error(`${source}: Failed to send Slack notification: ${slackErr?.message || slackErr}`)
        }
        return 'failed'
    } catch (err: any) {
        // Last line of defence: nothing in here may break the caller.
        logger.error(
            `${source}: Unexpected error sending accounting copy of ${doc.invoiceNumber}: ${err?.message || err}`
        )
        return 'failed'
    }
}
