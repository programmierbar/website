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

/**
 * Whether the interface sits on an existing item's detail page.
 *
 * Directus mounts interfaces with primary key `'+'` on the create page AND
 * while an existing item's record is still being loaded (the real key is only
 * passed in afterwards), so callers must re-evaluate when the key changes.
 */
export function isExistingItemKey(primaryKey: string | number | null | undefined): boolean {
    return Boolean(primaryKey && primaryKey !== '+')
}

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
        current !== null &&
        documents.some((doc) => doc.type === 'cancellation' && doc.related_invoice === current.id)

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
