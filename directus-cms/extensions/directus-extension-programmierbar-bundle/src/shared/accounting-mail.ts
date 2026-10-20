/**
 * Accounting copy of every invoice document.
 *
 * Each generated invoice document (Rechnung, Rechnungsberichtigung, Stornorechnung) is
 * mailed to an accounting mailbox, one PDF per mail, so it is recorded in the books
 * promptly (GoBD). This is a separate mail — never a BCC on the customer mail — and is
 * independent of whether the customer mail went out: the document exists either way.
 *
 * The accounting mailbox uploads attachments into the bookkeeping system and rejects
 * mails with links, images, logos or QR codes. So the mail is plain text only (no HTML,
 * no template, no links, no signature), carries exactly one PDF, and names the invoice
 * number in the subject. It sets no `from`, `sender` or `envelope`: Directus' MailService
 * fills `from` with EMAIL_FROM and nodemailer derives the SMTP envelope sender (MAIL FROM)
 * from it, so the envelope sender is the configured EMAIL_FROM.
 *
 * The mailbox comes from the `ACCOUNTING_INVOICE_EMAIL` Directus env var. Without it the
 * accounting copy is skipped (info log), so environments without bookkeeping (local,
 * staging) keep working unchanged.
 */

import { sendRawEmail, type EmailServiceContext } from './email-service.js'
import type { InvoiceDocumentKind } from './invoice-generator.js'
import { INVOICE_DOCUMENT_LABEL } from './invoice-service.js'
import { postSlackMessage } from './postSlackMessage.js'

export const ACCOUNTING_INVOICE_EMAIL_ENV = 'ACCOUNTING_INVOICE_EMAIL'

/** How often to attempt sending the accounting copy before escalating to Slack. */
export const ACCOUNTING_MAIL_ATTEMPTS = 3

export interface AccountingInvoiceDocument {
    documentKind: InvoiceDocumentKind
    invoiceNumber: string
    /** The exact bytes of the stored PDF. */
    pdfBuffer: Buffer
    /** Same file name as the stored PDF, e.g. `Rechnung-PB-CON26-001.pdf`. */
    invoiceFileName: string
    orderNumber?: string | null
    /** Number of the corrected/cancelled invoice (corrections and cancellations only). */
    referenceNumber?: string | null
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
    emailContext: EmailServiceContext
    /** Hook or endpoint name, for logs and the Slack alert. */
    source: string
}

/** The configured accounting mailbox, or null when the env var is unset or empty. */
export function getAccountingInvoiceEmail(env: Record<string, unknown> | undefined): string | null {
    const value = env?.[ACCOUNTING_INVOICE_EMAIL_ENV]
    if (typeof value !== 'string') {
        return null
    }
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

/** Minimal subject and one-line plain-text body — no cover letter needed. */
export function buildAccountingMail(doc: AccountingInvoiceDocument): { subject: string; text: string } {
    const name = `${INVOICE_DOCUMENT_LABEL[doc.documentKind]} ${doc.invoiceNumber}`
    const subject = doc.replacesPreviousVersion ? `${name} (ersetzt vorherige Fassung)` : name

    let text = name
    if (doc.referenceNumber) {
        text += ` zu Rechnung ${doc.referenceNumber}`
    }
    if (doc.orderNumber) {
        text += ` (Bestellung ${doc.orderNumber})`
    }
    text += ' im Anhang.'
    if (doc.replacesPreviousVersion) {
        text += ' Diese Fassung ersetzt die zuvor übermittelte mit derselben Rechnungsnummer.'
    }

    return { subject, text: `${text}\n` }
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
    const logger = emailContext.logger

    try {
        const to = getAccountingInvoiceEmail(options.env)
        if (!to) {
            logger.info(
                `${source}: ${ACCOUNTING_INVOICE_EMAIL_ENV} is not set — skipping accounting copy of ${doc.invoiceNumber}`
            )
            return 'skipped'
        }

        const { subject, text } = buildAccountingMail(doc)

        for (let attempt = 1; attempt <= ACCOUNTING_MAIL_ATTEMPTS; attempt++) {
            let sent = false
            try {
                sent = await sendRawEmail(
                    {
                        to,
                        subject,
                        text,
                        attachments: [
                            {
                                filename: doc.invoiceFileName,
                                content: doc.pdfBuffer,
                                contentType: 'application/pdf',
                            },
                        ],
                    },
                    emailContext
                )
            } catch (err: any) {
                logger.warn(`${source}: Accounting copy of ${doc.invoiceNumber} threw: ${err?.message || err}`)
            }

            if (sent) {
                logger.info(`${source}: Sent accounting copy of ${doc.invoiceNumber}`)
                return 'sent'
            }

            logger.warn(
                `${source}: Attempt ${attempt}/${ACCOUNTING_MAIL_ATTEMPTS} to send the accounting copy of ${doc.invoiceNumber} failed`
            )
        }

        const label = INVOICE_DOCUMENT_LABEL[doc.documentKind]
        const order = doc.orderNumber ? ` zu Bestellung ${doc.orderNumber}` : ''
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
