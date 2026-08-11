/// <reference types="@directus/extensions/api.d.ts" />
import { defineEndpoint } from '@directus/extensions-sdk'
import type { SandboxEndpointRouter } from 'directus:api'
import { generateInvoiceNumber } from '../shared/invoice-generator.js'
import {
    buildInvoiceSnapshot,
    ensureInvoiceDocuments,
    findCancellationFor,
    findCurrentInvoiceDocument,
    MissingDatePaidError,
    negateInvoiceSnapshot,
    parseInvoiceSnapshot,
    renderAndUploadInvoice,
    type InvoiceDocument,
    type RenderInvoiceResult,
} from '../shared/invoice-service.js'

const ENDPOINT_NAME = 'invoice-lifecycle'

const ORDER_FIELDS = [
    'id',
    'order_number',
    'conference',
    'status',
    'date_paid',
    'invoice_number',
    'invoice_file',
    'purchaser_first_name',
    'purchaser_last_name',
    'purchaser_email',
    'company_name',
    'company_vat_id',
    'billing_address_line1',
    'billing_address_line2',
    'billing_city',
    'billing_postal_code',
    'billing_country',
    'subtotal_cents',
    'discount_amount_cents',
    'total_cents',
    'total_gross_cents',
    'vat_amount_cents',
    'attendees_json',
    'ticket_type',
    'is_internal',
]

interface OrderContext {
    order: any
    conference: any
    ticketCount: number
    documents: InvoiceDocument[]
    currentDocument: InvoiceDocument | null
    ordersService: any
    invoicesService: any
    filesService: any
}

/**
 * GoBD-oriented invoice lifecycle for ticket orders. All routes are admin-only and
 * are strictly document operations:
 *
 * - POST /invoice-lifecycle/:id/regenerate    — replace the PDF of a NOT yet issued
 *   invoice (same number, same date). Blocked once the document has been sent.
 * - POST /invoice-lifecycle/:id/correction    — create a Rechnungsberichtigung: a new
 *   document with its own number from the same series, today's date, the order's
 *   current billing data and an explicit reference to the corrected invoice
 *   (§31 Abs. 5 UStDV). The original document stays untouched.
 * - POST /invoice-lifecycle/:id/cancellation  — create a Stornorechnung: a new
 *   document with its own number, negative amounts mirroring the referenced
 *   invoice's snapshot and an explicit reference to it. Touches neither Stripe nor
 *   tickets nor the order status.
 *
 * None of the routes sends an email, none deletes a file, and issued documents are
 * never modified — every operation only ever adds a new document or (pre-issuance)
 * swaps the PDF of the not-yet-sent one.
 */
export default defineEndpoint(async (router: SandboxEndpointRouter, context) => {
    const logger = context.logger
    const ItemsService = context.services.ItemsService
    const FilesService = context.services.FilesService
    const env = context.env

    class HttpError extends Error {
        status: number
        constructor(status: number, message: string) {
            super(message)
            this.status = status
        }
    }

    /**
     * Load the order, its conference and its invoice documents (lazily backfilling
     * the original document row for orders that predate the `ticket_invoices`
     * collection — those count as issued, since every pre-existing invoice was
     * emailed on payment).
     *
     * Services are created with the requesting admin's accountability so Directus
     * records the acting user (`user_created` on new document rows, `uploaded_by`
     * on files, plus the built-in activity/revisions trail).
     */
    async function loadOrderContext(req: any): Promise<OrderContext> {
        const schema = await context.getSchema()
        const accountability = req.accountability

        const ordersService = new ItemsService('ticket_orders', { schema, accountability })
        const invoicesService = new ItemsService('ticket_invoices', { schema, accountability })
        const filesService = new FilesService({ schema, accountability })

        let order: any = null
        try {
            order = await ordersService.readOne(req.params.id, { fields: ORDER_FIELDS })
        } catch {
            order = null
        }

        if (!order) {
            throw new HttpError(404, `Order ${req.params.id} not found`)
        }

        if (order.is_internal === true) {
            throw new HttpError(400, 'Internal orders have no invoice')
        }

        let ticketCount = 0
        try {
            const attendees =
                typeof order.attendees_json === 'string' ? JSON.parse(order.attendees_json) : order.attendees_json
            ticketCount = Array.isArray(attendees) ? attendees.length : 0
        } catch {
            ticketCount = 0
        }

        if (ticketCount === 0) {
            throw new HttpError(400, `Order ${order.order_number} has no attendees`)
        }

        const conferencesService = new ItemsService('conferences', { schema, accountability })
        const conference = await conferencesService.readOne(order.conference, { fields: ['title', 'start_on'] })

        if (!conference) {
            throw new HttpError(400, `Conference ${order.conference} not found`)
        }

        if (!order.invoice_number) {
            throw new HttpError(
                400,
                `Order ${order.order_number} has no invoice yet — lifecycle operations require an existing invoice`
            )
        }

        let documents: InvoiceDocument[]
        try {
            documents = await ensureInvoiceDocuments({
                order,
                conferenceTitle: conference.title,
                ticketCount,
                invoicesService,
            })
        } catch (err) {
            // Backfilling a legacy invoice needs a truthful issuance date: tell the
            // admin to set date_paid instead of silently recording a wrong one.
            if (err instanceof MissingDatePaidError) {
                throw new HttpError(400, err.message)
            }
            throw err
        }

        return {
            order,
            conference,
            ticketCount,
            documents,
            currentDocument: findCurrentInvoiceDocument(documents),
            ordersService,
            invoicesService,
            filesService,
        }
    }

    function registerRoute(action: string, handler: (req: any, ctx: OrderContext) => Promise<any>) {
        router.post(`/:id/${action}`, async (req, res) => {
            // Every lifecycle operation touches customer-facing financial documents: admins only.
            if (req.accountability?.admin !== true) {
                res.status(403).send({ error: 'Admin access required' })
                return
            }

            try {
                const ctx = await loadOrderContext(req)
                const result = await handler(req, ctx)
                res.status(200).send(result)
            } catch (err: any) {
                if (err instanceof HttpError) {
                    res.status(err.status).send({ error: err.message })
                    return
                }
                logger.error(
                    `${ENDPOINT_NAME}: Error in ${action} for order ${req.params.id}: ${err?.message || err}`
                )
                res.status(500).send({ error: `Failed to run invoice ${action}` })
            }
        })
    }

    function requireCurrentDocument(ctx: OrderContext): InvoiceDocument {
        if (!ctx.currentDocument) {
            throw new HttpError(400, `Order ${ctx.order.order_number} has no invoice document`)
        }
        return ctx.currentDocument
    }

    function storageLocation(): string | undefined {
        return env.STORAGE_LOCATIONS?.split(',')[0]
    }

    /**
     * Regenerate: replace the PDF of the current (not yet issued) invoice document
     * in place. Keeps the invoice number and the original invoice date. The previous
     * file is intentionally NOT deleted. Once the document has been sent, this is
     * blocked — issued documents are immutable and must be corrected instead.
     */
    registerRoute('regenerate', async (_req, ctx) => {
        const current = requireCurrentDocument(ctx)

        if (ctx.order.status !== 'paid') {
            throw new HttpError(400, `Order ${ctx.order.order_number} is not paid (status: ${ctx.order.status})`)
        }

        if (current.sent_at) {
            throw new HttpError(
                400,
                `Invoice ${current.invoice_number} has already been issued (sent at ${current.sent_at}) — create a Rechnungsberichtigung instead`
            )
        }

        if (findCancellationFor(ctx.documents, current.id)) {
            throw new HttpError(400, `Invoice ${current.invoice_number} has been cancelled`)
        }

        const snapshot = buildInvoiceSnapshot(ctx.order, ctx.conference.title, ctx.ticketCount)

        let rendered: RenderInvoiceResult
        if (current.type === 'correction') {
            // A regenerated correction must keep its printed reference to the corrected
            // invoice (§31 Abs. 5 UStDV) — without a resolvable predecessor the document
            // cannot be rendered lawfully, so refuse instead of rendering a broken PDF.
            const predecessor = ctx.documents.find((doc) => doc.id === current.related_invoice)
            if (!predecessor) {
                throw new HttpError(
                    400,
                    `Correction ${current.invoice_number} does not reference a known invoice document — cannot regenerate it with the legally required reference`
                )
            }
            rendered = await renderAndUploadInvoice({
                snapshot,
                invoiceNumber: current.invoice_number,
                invoiceDate: new Date(current.invoice_date),
                documentKind: 'correction',
                referenceNumber: predecessor.invoice_number,
                referenceDate: new Date(predecessor.invoice_date),
                filesService: ctx.filesService,
                storageLocation: storageLocation(),
            })
        } else {
            rendered = await renderAndUploadInvoice({
                snapshot,
                invoiceNumber: current.invoice_number,
                invoiceDate: new Date(current.invoice_date),
                documentKind: 'invoice',
                filesService: ctx.filesService,
                storageLocation: storageLocation(),
            })
        }

        // The document is not issued yet, so updating its PDF and snapshot in place is allowed.
        await ctx.invoicesService.updateOne(current.id, {
            invoice_file: rendered.fileId,
            snapshot_json: snapshot,
        })
        await ctx.ordersService.updateOne(ctx.order.id, { invoice_file: rendered.fileId })

        logger.info(
            `${ENDPOINT_NAME}: Regenerated invoice ${current.invoice_number} for order ${ctx.order.order_number} (file: ${rendered.fileId})`
        )

        return { invoice_number: current.invoice_number, invoice_file: rendered.fileId, document_id: current.id }
    })

    /**
     * Correction (Rechnungsberichtigung): create a NEW document from the order's
     * current billing data with its own invoice number and today's date, explicitly
     * referencing the corrected invoice. The corrected document stays untouched;
     * the order's legacy pointers move to the correction (the new authoritative
     * invoice). No email is sent.
     */
    registerRoute('correction', async (_req, ctx) => {
        const current = requireCurrentDocument(ctx)

        if (ctx.order.status !== 'paid') {
            throw new HttpError(400, `Order ${ctx.order.order_number} is not paid (status: ${ctx.order.status})`)
        }

        if (!current.sent_at) {
            throw new HttpError(
                400,
                `Invoice ${current.invoice_number} has not been issued yet — regenerate it instead of creating a correction`
            )
        }

        if (findCancellationFor(ctx.documents, current.id)) {
            throw new HttpError(400, `Invoice ${current.invoice_number} has been cancelled`)
        }

        const conferenceYear = new Date(ctx.conference.start_on).getFullYear()
        const invoiceNumber = await generateInvoiceNumber(ctx.ordersService, ctx.invoicesService, conferenceYear)
        const invoiceDate = new Date()

        const snapshot = buildInvoiceSnapshot(ctx.order, ctx.conference.title, ctx.ticketCount)
        const rendered = await renderAndUploadInvoice({
            snapshot,
            invoiceNumber,
            invoiceDate,
            documentKind: 'correction',
            referenceNumber: current.invoice_number,
            referenceDate: new Date(current.invoice_date),
            filesService: ctx.filesService,
            storageLocation: storageLocation(),
        })

        const documentId = await ctx.invoicesService.createOne({
            order: ctx.order.id,
            type: 'correction',
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate.toISOString(),
            invoice_file: rendered.fileId,
            related_invoice: current.id,
            snapshot_json: snapshot,
            sent_at: null,
        })

        // The correction is now the authoritative invoice of the order.
        await ctx.ordersService.updateOne(ctx.order.id, {
            invoice_number: invoiceNumber,
            invoice_file: rendered.fileId,
        })

        logger.info(
            `${ENDPOINT_NAME}: Created correction ${invoiceNumber} for invoice ${current.invoice_number} on order ${ctx.order.order_number} (file: ${rendered.fileId})`
        )

        return {
            invoice_number: invoiceNumber,
            invoice_file: rendered.fileId,
            document_id: documentId,
            corrects: current.invoice_number,
        }
    })

    /**
     * Cancellation (Stornorechnung): create a NEW document with its own invoice
     * number, negative amounts mirroring the referenced invoice's immutable snapshot
     * and an explicit reference to it. Deliberately does NOT touch Stripe, tickets,
     * the order status or the order's invoice pointers, and sends no email — it only
     * records the cancellation document.
     */
    registerRoute('cancellation', async (_req, ctx) => {
        const current = requireCurrentDocument(ctx)

        if (!current.sent_at) {
            throw new HttpError(
                400,
                `Invoice ${current.invoice_number} has not been issued yet — regenerate it instead of cancelling`
            )
        }

        if (findCancellationFor(ctx.documents, current.id)) {
            throw new HttpError(400, `Invoice ${current.invoice_number} has already been cancelled`)
        }

        // Mirror the amounts the referenced invoice was actually issued with. Every
        // document row carries a snapshot (lazy backfill provides one for legacy
        // invoices), so a missing/unparsable snapshot is a data problem — falling
        // back to the order's current mutable values could silently produce a storno
        // over the wrong amounts. Refuse instead.
        const referencedSnapshot = parseInvoiceSnapshot(current.snapshot_json)
        if (!referencedSnapshot) {
            throw new HttpError(
                400,
                `Invoice ${current.invoice_number} has no readable billing snapshot — cannot mirror its amounts for a Stornorechnung. Fix the document's snapshot_json first.`
            )
        }

        const conferenceYear = new Date(ctx.conference.start_on).getFullYear()
        const invoiceNumber = await generateInvoiceNumber(ctx.ordersService, ctx.invoicesService, conferenceYear)
        const invoiceDate = new Date()

        const snapshot = negateInvoiceSnapshot(referencedSnapshot)

        const rendered = await renderAndUploadInvoice({
            snapshot,
            invoiceNumber,
            invoiceDate,
            documentKind: 'cancellation',
            referenceNumber: current.invoice_number,
            referenceDate: new Date(current.invoice_date),
            filesService: ctx.filesService,
            storageLocation: storageLocation(),
        })

        const documentId = await ctx.invoicesService.createOne({
            order: ctx.order.id,
            type: 'cancellation',
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate.toISOString(),
            invoice_file: rendered.fileId,
            related_invoice: current.id,
            snapshot_json: snapshot,
            sent_at: null,
        })

        logger.info(
            `${ENDPOINT_NAME}: Created cancellation ${invoiceNumber} for invoice ${current.invoice_number} on order ${ctx.order.order_number} (file: ${rendered.fileId})`
        )

        return {
            invoice_number: invoiceNumber,
            invoice_file: rendered.fileId,
            document_id: documentId,
            cancels: current.invoice_number,
        }
    })
})
