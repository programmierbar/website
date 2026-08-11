/// <reference types="@directus/extensions/api.d.ts" />
import { defineEndpoint } from '@directus/extensions-sdk'
import type { SandboxEndpointRouter } from 'directus:api'
import { createAndStoreInvoice } from '../shared/invoice-service.js'

const ENDPOINT_NAME = 'regenerate-invoice'

export default defineEndpoint(async (router: SandboxEndpointRouter, context) => {
    const logger = context.logger
    const ItemsService = context.services.ItemsService
    const FilesService = context.services.FilesService
    const env = context.env

    /**
     * POST /regenerate-invoice/:id
     *
     * Re-renders the invoice PDF of a paid ticket order from its current billing fields
     * and stored amounts, uploads it as a new file, and points `invoice_file` at it.
     * Keeps the existing invoice number and the original invoice date (`date_paid`).
     * Sends no emails.
     */
    router.post('/:id', async (req, res) => {
        // Regenerating replaces the customer-facing financial document: admins only.
        if (req.accountability?.admin !== true) {
            res.status(403).send({ error: 'Admin access required' })
            return
        }

        const orderId = req.params.id

        try {
            const schema = await context.getSchema()

            const ordersService = new ItemsService('ticket_orders', {
                schema,
                accountability: { admin: true },
            })

            let order: any = null
            try {
                order = await ordersService.readOne(orderId, {
                    fields: [
                        'id',
                        'order_number',
                        'conference',
                        'status',
                        'date_paid',
                        'invoice_number',
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
                    ],
                })
            } catch {
                order = null
            }

            if (!order) {
                res.status(404).send({ error: `Order ${orderId} not found` })
                return
            }

            if (order.is_internal === true) {
                res.status(400).send({ error: 'Internal orders have no invoice' })
                return
            }

            if (order.status !== 'paid') {
                res.status(400).send({ error: `Order ${order.order_number} is not paid (status: ${order.status})` })
                return
            }

            if (!order.invoice_number) {
                res.status(400).send({
                    error: `Order ${order.order_number} has no invoice yet — regeneration only re-issues an existing invoice`,
                })
                return
            }

            // The regenerated invoice must carry the original invoice date, which equals the
            // payment date (the initial invoice is generated the moment the order is paid).
            if (!order.date_paid) {
                res.status(400).send({
                    error: `Order ${order.order_number} has no date_paid — set it before regenerating the invoice`,
                })
                return
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
                res.status(400).send({ error: `Order ${order.order_number} has no attendees` })
                return
            }

            const conferencesService = new ItemsService('conferences', {
                schema,
                accountability: { admin: true },
            })

            const conference = await conferencesService.readOne(order.conference, { fields: ['title'] })

            if (!conference) {
                res.status(400).send({ error: `Conference ${order.conference} not found` })
                return
            }

            const filesService = new FilesService({
                accountability: { admin: true },
                schema,
            })

            // Reuse the stored invoice number: it identifies the already-issued invoice, and
            // minting a new one (generateInvoiceNumber) would advance the sequence and leave a gap.
            // The previous invoice_file is intentionally NOT deleted so the originally issued
            // document stays retrievable; only the order's pointer moves to the new file.
            const { fileId } = await createAndStoreInvoice({
                order,
                conferenceTitle: conference.title,
                ticketCount,
                invoiceNumber: order.invoice_number,
                invoiceDate: new Date(order.date_paid),
                ordersService,
                filesService,
                storageLocation: env.STORAGE_LOCATIONS?.split(',')[0],
            })

            logger.info(
                `${ENDPOINT_NAME}: Regenerated invoice ${order.invoice_number} for order ${order.order_number} (file: ${fileId})`
            )

            res.status(200).send({ invoice_number: order.invoice_number, invoice_file: fileId })
        } catch (err: any) {
            logger.error(`${ENDPOINT_NAME}: Error regenerating invoice for order ${orderId}: ${err?.message || err}`)
            res.status(500).send({ error: 'Failed to regenerate invoice' })
        }
    })
})
