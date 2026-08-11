import { Readable } from 'node:stream'
import { generateInvoicePdf, ticketTypeLabel, type InvoiceData, type InvoiceDocumentKind } from './invoice-generator.js'

/** Order fields required to assemble an invoice (subset of `ticket_orders`). */
export interface InvoiceOrder {
    id: string | number
    order_number?: string
    purchaser_first_name: string
    purchaser_last_name: string
    purchaser_email: string
    company_name: string | null
    company_vat_id: string | null
    billing_address_line1: string | null
    billing_address_line2: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_country: string | null
    subtotal_cents: number | null
    discount_amount_cents: number | null
    total_cents: number | null
    total_gross_cents: number | null
    vat_amount_cents: number | null
    ticket_type: string
}

/** Document types stored in `ticket_invoices.type`. */
export type InvoiceDocumentType = 'original' | 'correction' | 'cancellation'

/**
 * Immutable snapshot of the billing data and amounts a document was rendered from.
 * Stored as `ticket_invoices.snapshot_json` so an issued document stays reproducible
 * even after the order's billing fields change (GoBD: issued documents are frozen).
 */
export interface InvoiceSnapshot {
    order_id: string | number
    order_number: string | null
    purchaser_name: string
    purchaser_email: string
    company_name: string | null
    company_vat_id: string | null
    billing_address_line1: string | null
    billing_address_line2: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_country: string | null
    conference_title: string
    ticket_type: string
    ticket_count: number
    unit_price_gross_cents: number
    subtotal_cents: number
    discount_amount_cents: number
    vat_amount_cents: number
    total_gross_cents: number
}

/** A row of the `ticket_invoices` collection. */
export interface InvoiceDocument {
    id: string
    order: string
    type: InvoiceDocumentType
    invoice_number: string
    invoice_date: string
    invoice_file: string | null
    related_invoice: string | null
    snapshot_json: InvoiceSnapshot | string | null
    sent_at: string | null
}

export function formatInvoiceDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

/**
 * Build the immutable billing/amount snapshot for an order as it looks right now.
 */
export function buildInvoiceSnapshot(order: InvoiceOrder, conferenceTitle: string, ticketCount: number): InvoiceSnapshot {
    // Derive per-ticket price from the pre-discount subtotal so the line item reconciles
    // with Zwischensumme; the Rabatt line takes us down to the actual total.
    // `??` (not `||`) everywhere below: 0 is a legitimate stored amount (free orders,
    // 100% discounts, 0 VAT) and must not be treated as missing.
    const subtotalCents = order.subtotal_cents ?? order.total_cents ?? 0
    const baseUnitNetCents = Math.round(subtotalCents / ticketCount)
    const grossPerTicket = Math.round(baseUnitNetCents * 1.19)

    return {
        order_id: order.id,
        order_number: order.order_number ?? null,
        purchaser_name: `${order.purchaser_first_name} ${order.purchaser_last_name}`,
        purchaser_email: order.purchaser_email,
        company_name: order.company_name,
        company_vat_id: order.company_vat_id,
        billing_address_line1: order.billing_address_line1,
        billing_address_line2: order.billing_address_line2,
        billing_city: order.billing_city,
        billing_postal_code: order.billing_postal_code,
        billing_country: order.billing_country,
        conference_title: conferenceTitle,
        ticket_type: order.ticket_type,
        ticket_count: ticketCount,
        unit_price_gross_cents: grossPerTicket,
        subtotal_cents: subtotalCents,
        discount_amount_cents: order.discount_amount_cents ?? 0,
        vat_amount_cents: order.vat_amount_cents ?? 0,
        total_gross_cents: order.total_gross_cents ?? order.total_cents ?? 0,
    }
}

/**
 * Mirror a snapshot with negated amounts for a Stornorechnung. Ticket count stays
 * positive; every monetary value flips sign so the storno exactly offsets the
 * referenced invoice.
 */
export function negateInvoiceSnapshot(snapshot: InvoiceSnapshot): InvoiceSnapshot {
    return {
        ...snapshot,
        unit_price_gross_cents: -snapshot.unit_price_gross_cents,
        subtotal_cents: -snapshot.subtotal_cents,
        discount_amount_cents: -snapshot.discount_amount_cents,
        vat_amount_cents: -snapshot.vat_amount_cents,
        total_gross_cents: -snapshot.total_gross_cents,
    }
}

/** `snapshot_json` may come back from Directus as a string depending on the driver. */
export function parseInvoiceSnapshot(raw: InvoiceSnapshot | string | null | undefined): InvoiceSnapshot | null {
    if (!raw) {
        return null
    }
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw) as InvoiceSnapshot
        } catch {
            return null
        }
    }
    return raw
}

interface RenderInvoiceBaseParams {
    snapshot: InvoiceSnapshot
    invoiceNumber: string
    invoiceDate: Date
    filesService: any
    storageLocation?: string
}

/**
 * Mirrors the `InvoiceData` union: corrections and cancellations must reference
 * the corrected/cancelled invoice by number AND date (§31 Abs. 5 UStDV), a plain
 * invoice never carries a reference.
 */
export type RenderInvoiceParams =
    | (RenderInvoiceBaseParams & {
          documentKind?: 'invoice'
          referenceNumber?: never
          referenceDate?: never
      })
    | (RenderInvoiceBaseParams & {
          documentKind: 'correction' | 'cancellation'
          referenceNumber: string
          referenceDate: Date
      })

export interface RenderInvoiceResult {
    fileId: string
    pdfBuffer: Buffer
    invoiceFileName: string
}

const KIND_LABEL: Record<InvoiceDocumentKind, string> = {
    invoice: 'Rechnung',
    correction: 'Rechnungsberichtigung',
    cancellation: 'Stornorechnung',
}

/**
 * Render a document PDF from a snapshot and upload it to Directus files.
 * Does NOT touch any order or `ticket_invoices` row — callers decide what the
 * new file replaces or which document row it belongs to.
 */
export async function renderAndUploadInvoice(params: RenderInvoiceParams): Promise<RenderInvoiceResult> {
    const { snapshot, invoiceNumber, invoiceDate, filesService } = params
    const kind: InvoiceDocumentKind = params.documentKind || 'invoice'

    const baseData = {
        invoiceNumber,
        invoiceDate: formatInvoiceDate(invoiceDate),
        purchaserName: snapshot.purchaser_name,
        purchaserEmail: snapshot.purchaser_email,
        companyName: snapshot.company_name,
        companyVatId: snapshot.company_vat_id,
        billingAddressLine1: snapshot.billing_address_line1,
        billingAddressLine2: snapshot.billing_address_line2,
        billingCity: snapshot.billing_city,
        billingPostalCode: snapshot.billing_postal_code,
        billingCountry: snapshot.billing_country,
        conferenceTitle: snapshot.conference_title,
        ticketType: ticketTypeLabel(snapshot.ticket_type),
        ticketCount: snapshot.ticket_count,
        unitPriceGrossCents: snapshot.unit_price_gross_cents,
        subtotalCents: snapshot.subtotal_cents,
        discountAmountCents: snapshot.discount_amount_cents,
        vatAmountCents: snapshot.vat_amount_cents,
        totalGrossCents: snapshot.total_gross_cents,
    }

    let invoiceData: InvoiceData
    if (kind === 'invoice') {
        invoiceData = { ...baseData, documentKind: 'invoice' }
    } else {
        // Runtime backstop for callers outside the type system: a correction or
        // cancellation without a complete reference would render "vom undefined"
        // and be legally defective (§31 Abs. 5 UStDV).
        if (!params.referenceNumber || !params.referenceDate) {
            throw new Error(`A ${kind} document requires the referenced invoice's number and date`)
        }
        invoiceData = {
            ...baseData,
            documentKind: kind,
            referenceNumber: params.referenceNumber,
            referenceDate: formatInvoiceDate(params.referenceDate),
        }
    }

    const pdfBuffer = await generateInvoicePdf(invoiceData)

    const label = KIND_LABEL[kind]
    const invoiceFileName = `${label}-${invoiceNumber}.pdf`
    const pdfStream = Readable.from([pdfBuffer])
    const fileId = await filesService.uploadOne(pdfStream, {
        type: 'application/pdf',
        filename_download: invoiceFileName,
        title: `${label} ${invoiceNumber}`,
        ...(params.storageLocation && { storage: params.storageLocation }),
    })

    return { fileId, pdfBuffer, invoiceFileName }
}

export interface IssueOriginalInvoiceParams {
    order: InvoiceOrder
    conferenceTitle: string
    ticketCount: number
    invoiceNumber: string
    invoiceDate: Date
    ordersService: any
    invoicesService: any
    filesService: any
    storageLocation?: string
}

export interface IssueOriginalInvoiceResult extends RenderInvoiceResult {
    documentId: string
    snapshot: InvoiceSnapshot
}

/**
 * Create the original invoice for an order: snapshot the billing data, render and
 * upload the PDF, record the document in `ticket_invoices` (sent_at stays null until
 * the confirmation email actually went out) and point the order's legacy
 * `invoice_number` / `invoice_file` fields at it.
 */
export async function issueOriginalInvoice(params: IssueOriginalInvoiceParams): Promise<IssueOriginalInvoiceResult> {
    const { order, conferenceTitle, ticketCount, invoiceNumber, invoiceDate, ordersService, invoicesService } = params

    const snapshot = buildInvoiceSnapshot(order, conferenceTitle, ticketCount)

    const rendered = await renderAndUploadInvoice({
        snapshot,
        invoiceNumber,
        invoiceDate,
        documentKind: 'invoice',
        filesService: params.filesService,
        storageLocation: params.storageLocation,
    })

    const documentId = await invoicesService.createOne({
        order: order.id,
        type: 'original',
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate.toISOString(),
        invoice_file: rendered.fileId,
        related_invoice: null,
        snapshot_json: snapshot,
        sent_at: null,
    })

    // Keep the legacy pointers on the order in sync (current authoritative document).
    await ordersService.updateOne(order.id, {
        invoice_number: invoiceNumber,
        invoice_file: rendered.fileId,
    })

    return { ...rendered, documentId, snapshot }
}

/**
 * Record that a document left the house (confirmation email sent, or manual dispatch).
 * From this moment on the document counts as issued and may only be corrected or
 * cancelled — never regenerated in place.
 */
export async function markInvoiceSent(invoicesService: any, documentId: string, sentAt: Date = new Date()): Promise<void> {
    await invoicesService.updateOne(documentId, { sent_at: sentAt.toISOString() })
}

/**
 * All invoice documents of an order, oldest first.
 */
export async function readInvoiceDocuments(invoicesService: any, orderId: string | number): Promise<InvoiceDocument[]> {
    const rows = await invoicesService.readByQuery({
        filter: { order: { _eq: orderId } },
        fields: [
            'id',
            'order',
            'type',
            'invoice_number',
            'invoice_date',
            'invoice_file',
            'related_invoice',
            'snapshot_json',
            'sent_at',
        ],
        sort: ['date_created'],
        limit: -1,
    })
    return rows || []
}

/**
 * The current authoritative invoice of an order: the most recent original/correction
 * document. Cancellations are separate documents that void their reference — they
 * never become the authoritative invoice themselves.
 */
export function findCurrentInvoiceDocument(documents: InvoiceDocument[]): InvoiceDocument | null {
    for (let i = documents.length - 1; i >= 0; i--) {
        const doc = documents[i]
        if (doc && (doc.type === 'original' || doc.type === 'correction')) {
            return doc
        }
    }
    return null
}

/** The cancellation document referencing the given document, if any. */
export function findCancellationFor(documents: InvoiceDocument[], documentId: string): InvoiceDocument | null {
    return documents.find((doc) => doc.type === 'cancellation' && doc.related_invoice === documentId) || null
}

/**
 * Thrown by {@link ensureInvoiceDocuments} when a legacy invoice cannot be
 * backfilled because the order has no `date_paid`. Callers surface this as a
 * client error (the admin must set the payment date first) — silently stamping
 * "now" as the issuance date would falsify the audit trail.
 */
export class MissingDatePaidError extends Error {
    constructor(orderNumber: string | null | undefined) {
        super(
            `Order ${orderNumber || '(unknown)'} has no date_paid — cannot backfill its invoice document with a truthful issuance date. Set the order's payment date first.`
        )
        this.name = 'MissingDatePaidError'
    }
}

export interface EnsureInvoiceDocumentParams {
    order: InvoiceOrder & { invoice_number?: string | null; invoice_file?: string | null; date_paid?: string | null }
    conferenceTitle: string
    ticketCount: number
    invoicesService: any
}

/**
 * Lazy backfill for orders that received their invoice before the `ticket_invoices`
 * collection existed: if the order carries an invoice but has no document rows yet,
 * create the original document row from the order's current data.
 *
 * Pre-existing invoices were all emailed on payment, so the backfilled row is marked
 * as sent (issued) at `date_paid` — they can only be corrected or cancelled, never
 * regenerated. The snapshot is the best available data (the order's current billing
 * fields); the original PDF in `invoice_file` remains the authoritative rendering.
 *
 * Throws {@link MissingDatePaidError} when the backfill is needed but the order has
 * no `date_paid` — there is no truthful issuance date to record in that case.
 *
 * Returns the documents list of the order including any backfilled row.
 */
export async function ensureInvoiceDocuments(params: EnsureInvoiceDocumentParams): Promise<InvoiceDocument[]> {
    const { order, invoicesService } = params

    const documents = await readInvoiceDocuments(invoicesService, order.id)
    if (documents.length > 0 || !order.invoice_number) {
        return documents
    }

    if (!order.date_paid) {
        throw new MissingDatePaidError(order.order_number)
    }

    const issuedAt = new Date(order.date_paid)
    const snapshot = buildInvoiceSnapshot(order, params.conferenceTitle, params.ticketCount)

    await invoicesService.createOne({
        order: order.id,
        type: 'original',
        invoice_number: order.invoice_number,
        invoice_date: issuedAt.toISOString(),
        invoice_file: order.invoice_file ?? null,
        related_invoice: null,
        snapshot_json: snapshot,
        sent_at: issuedAt.toISOString(),
    })

    return readInvoiceDocuments(invoicesService, order.id)
}
