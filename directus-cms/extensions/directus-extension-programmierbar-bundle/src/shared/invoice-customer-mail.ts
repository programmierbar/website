/**
 * Customer dispatch of invoice documents.
 *
 * A document counts as issued once it left the house: a successfully sent customer
 * mail stamps `sent_at` on its `ticket_invoices` row. From then on it can only be
 * corrected or cancelled, never regenerated in place.
 *
 * - The original invoice goes out with the order confirmation (`ticket-order-processing`,
 *   template `ticket_order_confirmation`) and only uses {@link recordInvoiceSent} from here.
 * - Rechnungsberichtigungen and Stornorechnungen are created by the `invoice-lifecycle`
 *   endpoint and mailed with {@link sendInvoiceDocumentToCustomer}: same recipients as the
 *   original (purchaser, CC billing_email), same mail path (Directus MailService), each
 *   with its own `email_templates` row ({@link CUSTOMER_MAIL_TEMPLATE_KEY}).
 *
 * Neither function throws: a mail problem must never turn a stored document into an
 * error. Everything that needs a human (send failure, missing template, lost `sent_at`)
 * is escalated to Slack. There is deliberately no fallback mail text: without its
 * template a document is not sent and the alert says which template to create.
 *
 * This is independent of the accounting copy (`accounting-mail.ts`), which never
 * touches `sent_at`.
 */

import { deliverTemplatedEmail, type EmailServiceContext } from './email-service.js'
import { formatInvoiceDate, INVOICE_DOCUMENT_LABEL, markInvoiceSent } from './invoice-service.js'
import { postSlackMessage } from './postSlackMessage.js'

/** How often to attempt stamping `sent_at` on the invoice document row. */
export const MARK_SENT_ATTEMPTS = 3

/** Kinds of document the lifecycle endpoint mails to the customer. */
export type CustomerMailDocumentKind = 'correction' | 'cancellation'

/** `email_templates` keys of the customer mails for corrections and cancellations. */
export const CUSTOMER_MAIL_TEMPLATE_KEY: Record<CustomerMailDocumentKind, string> = {
    correction: 'ticket_invoice_correction',
    cancellation: 'ticket_invoice_cancellation',
}

/** `template_missing`: no `email_templates` row with the key — create it in the CMS. */
export type CustomerMailResult = 'sent' | 'failed' | 'template_missing'

interface Logger {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
}

async function notifySlack(logger: Logger, source: string, message: string): Promise<void> {
    try {
        await postSlackMessage(message)
    } catch (slackErr: any) {
        logger.error(`${source}: Failed to send Slack notification: ${slackErr?.message || slackErr}`)
    }
}

export interface RecordInvoiceSentParams {
    invoicesService: any
    documentId: string
    /** "Rechnung", "Rechnungsberichtigung", … — for logs and the Slack alert. */
    documentLabel: string
    invoiceNumber: string
    orderNumber: string
    /** Address the document was mailed to, for the Slack alert. */
    recipient: string
    logger: Logger
    /** Hook or endpoint name, for logs and the Slack alert. */
    source: string
}

/**
 * Stamp `sent_at` after the document was mailed to the customer. The customer now
 * holds an issued document, so a lost update would wrongly allow regenerating it in
 * place: retry, and if it keeps failing escalate to Slack so a human sets `sent_at`.
 * Returns whether the stamp was stored. Never throws.
 */
export async function recordInvoiceSent(params: RecordInvoiceSentParams): Promise<boolean> {
    const { logger, source, documentLabel, invoiceNumber, orderNumber, documentId } = params

    const sentAt = new Date() // capture once: retries must not shift the recorded time
    let markSentError: unknown = null
    for (let attempt = 1; attempt <= MARK_SENT_ATTEMPTS; attempt++) {
        try {
            await markInvoiceSent(params.invoicesService, documentId, sentAt)
            return true
        } catch (err: any) {
            markSentError = err
            logger.warn(
                `${source}: Attempt ${attempt}/${MARK_SENT_ATTEMPTS} to mark ${documentLabel} ${invoiceNumber} as sent failed: ${err?.message || err}`
            )
        }
    }

    const reason = (markSentError as any)?.message || markSentError
    logger.error(
        `${source}: ${documentLabel} ${invoiceNumber} for order ${orderNumber} was emailed to ${params.recipient}, but stamping sent_at on document ${documentId} failed persistently: ${reason}`
    )
    await notifySlack(
        logger,
        source,
        `:warning: *${source}*: ${documentLabel} ${invoiceNumber} zu Bestellung ${orderNumber} wurde per E-Mail an ${params.recipient} verschickt, aber sent_at konnte auf dem Rechnungsdokument (${documentId}) nicht gespeichert werden: ${reason}. Bitte sent_at manuell setzen — sonst erlaubt der Invoice-Lifecycle-Endpoint, das bereits verschickte Dokument in-place neu zu generieren.`
    )
    return false
}

export interface CustomerInvoiceDocument {
    documentKind: CustomerMailDocumentKind
    /** The `ticket_invoices` row of the new document. */
    documentId: string
    invoiceNumber: string
    invoiceDate: Date
    /** Number and date of the corrected/cancelled invoice. */
    referenceNumber: string
    referenceDate: Date
    /** The exact bytes and file name of the stored PDF. */
    pdfBuffer: Buffer
    invoiceFileName: string
}

export interface CustomerInvoiceOrder {
    order_number: string
    purchaser_first_name?: string | null
    purchaser_last_name?: string | null
    purchaser_email?: string | null
    billing_email?: string | null
}

export interface SendInvoiceDocumentToCustomerOptions {
    order: CustomerInvoiceOrder
    conferenceTitle: string
    /** Service for the `ticket_invoices` collection, used to stamp `sent_at`. */
    invoicesService: any
    emailContext: EmailServiceContext
    logger: Logger
    source: string
}

/**
 * Mail a Rechnungsberichtigung or Stornorechnung to the customer — To: purchaser, CC:
 * billing_email (the recipients of the original invoice) — with the stored PDF
 * attached, and stamp `sent_at` on success. On failure `sent_at` stays null and Slack
 * is alerted so the PDF is dispatched by hand. Never throws.
 */
export async function sendInvoiceDocumentToCustomer(
    doc: CustomerInvoiceDocument,
    options: SendInvoiceDocumentToCustomerOptions
): Promise<CustomerMailResult> {
    const { order, logger, source } = options
    const label = INVOICE_DOCUMENT_LABEL[doc.documentKind]
    const templateKey = CUSTOMER_MAIL_TEMPLATE_KEY[doc.documentKind]
    const name = `${label} ${doc.invoiceNumber} zu Bestellung ${order.order_number}`
    const manualDispatch = `Bitte das PDF (${doc.invoiceFileName}) aus Directus manuell an den Kunden schicken und danach sent_at am Rechnungsdokument (${doc.documentId}) setzen.`

    try {
        const to = order.purchaser_email?.trim()
        if (!to) {
            logger.error(`${source}: ${name} cannot be mailed to the customer: the order has no purchaser_email`)
            await notifySlack(
                logger,
                source,
                `:x: *${source}*: ${name} wurde NICHT an den Kunden verschickt — die Bestellung hat keine purchaser_email. ${manualDispatch}`
            )
            return 'failed'
        }

        const result = await deliverTemplatedEmail(
            {
                templateKey,
                to,
                cc: order.billing_email?.trim() || undefined,
                data: {
                    purchaser_name: [order.purchaser_first_name, order.purchaser_last_name].filter(Boolean).join(' '),
                    conference_title: options.conferenceTitle,
                    order_number: order.order_number,
                    invoice_number: doc.invoiceNumber,
                    invoice_date: formatInvoiceDate(doc.invoiceDate),
                    reference_invoice_number: doc.referenceNumber,
                    reference_invoice_date: formatInvoiceDate(doc.referenceDate),
                },
                attachments: [
                    { filename: doc.invoiceFileName, content: doc.pdfBuffer, contentType: 'application/pdf' },
                ],
            },
            options.emailContext
        )

        if (result === 'template_missing') {
            logger.error(
                `${source}: ${name} was not mailed to the customer: email template '${templateKey}' does not exist`
            )
            await notifySlack(
                logger,
                source,
                `:x: *${source}*: ${name} wurde NICHT an den Kunden verschickt — die E-Mail-Vorlage \`${templateKey}\` fehlt in \`email_templates\`. Bitte die Vorlage anlegen (siehe docs/tickets.md). ${manualDispatch}`
            )
            return 'template_missing'
        }

        if (result !== 'sent') {
            logger.error(`${source}: ${name} could not be mailed to the customer (${to})`)
            await notifySlack(
                logger,
                source,
                `:x: *${source}*: ${name} konnte nicht an den Kunden (${to}) verschickt werden. Details im Directus-Log. ${manualDispatch}`
            )
            return 'failed'
        }

        logger.info(`${source}: Sent ${label} ${doc.invoiceNumber} to the customer (${to})`)
        // The mail went out either way; a lost stamp is escalated inside.
        await recordInvoiceSent({
            invoicesService: options.invoicesService,
            documentId: doc.documentId,
            documentLabel: label,
            invoiceNumber: doc.invoiceNumber,
            orderNumber: order.order_number,
            recipient: to,
            logger,
            source,
        })
        return 'sent'
    } catch (err: any) {
        // Last line of defence: nothing in here may break the caller.
        logger.error(`${source}: Unexpected error mailing ${name} to the customer: ${err?.message || err}`)
        await notifySlack(
            logger,
            source,
            `:x: *${source}*: ${name} konnte nicht an den Kunden verschickt werden (${err?.message || err}). ${manualDispatch}`
        )
        return 'failed'
    }
}
