/**
 * Pure client-side state derivation for the invoice actions interface.
 *
 * Mirrors the server-side semantics of `findCurrentInvoiceDocument` /
 * `findCancellationFor` in `shared/invoice-service.ts`, but works on the
 * plain rows the Directus app fetches — the shared service cannot be imported
 * into the app bundle because it pulls in server-only dependencies (pdfkit).
 */

export interface InvoiceDocumentRow {
    id: string
    type: 'original' | 'correction' | 'cancellation'
    invoice_number: string
    sent_at: string | null
    related_invoice: string | null
}

export interface InvoiceActionsState {
    /** The order has an invoice (a document row or a legacy `invoice_number`). */
    hasInvoice: boolean
    /** The current invoice document has been cancelled — no further actions. */
    isCancelled: boolean
    /** Show "Rechnung neu generieren" (invoice exists but was not issued yet). */
    showRegenerate: boolean
    /** Show "Berichtigung" / "Storno" (invoice was issued and not cancelled). */
    showPostIssuanceActions: boolean
}

// Shared with the newsletter actions interface; re-exported so existing imports keep working.
export { isExistingItemKey } from '../shared/itemKey.js'

/** The latest original/correction document — the one actions operate on. */
function findCurrentDocument(documents: InvoiceDocumentRow[]): InvoiceDocumentRow | null {
    for (let i = documents.length - 1; i >= 0; i--) {
        const doc = documents[i]
        if (doc && (doc.type === 'original' || doc.type === 'correction')) {
            return doc
        }
    }
    return null
}

export function deriveInvoiceActionsState(
    orderInvoiceNumber: string | null,
    documents: InvoiceDocumentRow[]
): InvoiceActionsState {
    const current = findCurrentDocument(documents)

    const isCancelled =
        current !== null && documents.some((doc) => doc.type === 'cancellation' && doc.related_invoice === current.id)

    // Orders that got their invoice before the ticket_invoices collection existed
    // have no document rows yet; all pre-existing invoices were emailed, so they
    // count as issued.
    const isIssued = current ? current.sent_at !== null : orderInvoiceNumber !== null

    const hasInvoice = orderInvoiceNumber !== null || current !== null

    return {
        hasInvoice,
        isCancelled,
        showRegenerate: hasInvoice && !isIssued && !isCancelled,
        showPostIssuanceActions: hasInvoice && isIssued && !isCancelled,
    }
}

export type InvoiceActionKey = 'regenerate' | 'correction' | 'cancellation'

/** The fields of an `invoice-lifecycle` response the result notice reports on. */
export interface InvoiceActionResponse {
    invoice_number?: string
    corrects?: string
    cancels?: string
    accounting_mail?: string
    customer_mail?: string
}

const ACCOUNTING_MAIL_TEXT: Record<string, string> = {
    sent: 'Kopie an die Buchhaltung verschickt.',
    failed: 'Kopie an die Buchhaltung fehlgeschlagen — Hinweis ging an Slack, bitte manuell weiterleiten.',
    skipped: 'Keine Kopie an die Buchhaltung (Postfach nicht konfiguriert).',
    misconfigured:
        'Keine Kopie an die Buchhaltung: SMTP-Zugang unvollständig konfiguriert (siehe Slack) — bitte manuell weiterleiten.',
}

const MANUAL_DISPATCH = 'Bitte das PDF manuell an den Kunden schicken und danach sent_at am Rechnungsdokument setzen.'

const CUSTOMER_MAIL_TEXT: Record<string, string> = {
    sent: 'An den Kunden verschickt.',
    failed: `NICHT an den Kunden verschickt — der Versand ist fehlgeschlagen (siehe Slack). ${MANUAL_DISPATCH}`,
    template_missing: `NICHT an den Kunden verschickt — die E-Mail-Vorlage fehlt in Directus (siehe Slack). ${MANUAL_DISPATCH}`,
}

/**
 * Result notice after a successful lifecycle call. A correction or cancellation that did
 * not reach the customer is a warning: the document exists but still has to be sent.
 */
export function describeActionResult(
    action: InvoiceActionKey,
    data: InvoiceActionResponse
): { type: 'success' | 'warning'; text: string } {
    const nr = data.invoice_number
    const accounting = ACCOUNTING_MAIL_TEXT[data.accounting_mail ?? ''] ?? ''

    if (action === 'regenerate') {
        return {
            type: 'success',
            text: `Rechnung ${nr} wurde neu generiert. Seite neu laden, um die neue Datei zu sehen. ${accounting}`.trim(),
        }
    }

    const created =
        action === 'correction'
            ? `Rechnungsberichtigung ${nr} wurde erstellt (berichtigt ${data.corrects}).`
            : `Stornorechnung ${nr} wurde erstellt (storniert ${data.cancels}).`
    const customerSent = data.customer_mail === 'sent'
    const customer =
        CUSTOMER_MAIL_TEXT[data.customer_mail ?? ''] ?? `Versand an den Kunden unbekannt. ${MANUAL_DISPATCH}`

    return {
        type: customerSent ? 'success' : 'warning',
        text: `${created} ${customer} ${accounting}`.trim(),
    }
}
