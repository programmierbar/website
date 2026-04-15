import { defineHook } from '@directus/extensions-sdk'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { sendTemplatedEmail, getSetting, type EmailServiceContext } from '../shared/email-service.js'
import { generateUniqueTicketCode, formatPrice } from '../shared/ticket-utils.js'
import {
    generateInvoicePdf,
    generateInvoiceNumber,
    ticketTypeLabel,
    type InvoiceData,
} from '../shared/invoice-generator.js'

const HOOK_NAME = 'ticket-order-processing'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema
    const env = hookContext.env
    const ItemsService = services.ItemsService
    const FilesService = services.FilesService

    // Check if MailService is available
    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. Email notifications will not work.`)
        logger.warn(`${HOOK_NAME}: Make sure Directus email is configured in .env (EMAIL_TRANSPORT, etc.)`)
    }

    /**
     * Process order when status changes to 'paid'
     * Creates tickets with profile tokens, generates invoice, and sends emails
     * (QR codes are generated later when the attendee completes their profile)
     */
    action('ticket_orders.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if status is being set to 'paid'
        if (payload.status !== 'paid') {
            return
        }

        const context: EmailServiceContext = {
            logger,
            services,
            getSchema,
            accountability: eventContext.accountability,
        }

        try {
            const schema = await getSchema()

            const ordersService = new ItemsService('ticket_orders', {
                schema,
                accountability: { admin: true },
            })

            const ticketsService = new ItemsService('tickets', {
                schema,
                accountability: { admin: true },
            })

            const conferencesService = new ItemsService('conferences', {
                schema,
                accountability: { admin: true },
            })

            const websiteUrl = (await getSetting('website_url', context)) || 'https://programmier.bar'

            for (const orderId of keys) {
                logger.info(`${HOOK_NAME}: Processing paid order ${orderId}`)

                // Get order details (including billing fields for invoice)
                const order = await ordersService.readOne(orderId, {
                    fields: [
                        'id',
                        'order_number',
                        'conference',
                        'purchase_type',
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
                        'billing_email',
                        'subtotal_cents',
                        'discount_amount_cents',
                        'total_cents',
                        'total_gross_cents',
                        'vat_amount_cents',
                        'attendees_json',
                        'ticket_type',
                    ],
                })

                if (!order) {
                    logger.error(`${HOOK_NAME}: Order ${orderId} not found`)
                    continue
                }

                // Get conference details (title + start_on for invoice year + ticket limit)
                const conference = await conferencesService.readOne(order.conference, {
                    fields: ['title', 'start_on', 'ticket_max_quantity'],
                })

                if (!conference) {
                    logger.error(`${HOOK_NAME}: Conference ${order.conference} not found`)
                    continue
                }

                // Get attendees from order (Directus may already parse JSON fields)
                let attendees: Array<{ firstName: string; lastName: string; email: string }> = []
                try {
                    if (order.attendees_json) {
                        // Handle both cases: already parsed (object/array) or string
                        if (typeof order.attendees_json === 'string') {
                            attendees = JSON.parse(order.attendees_json)
                        } else if (Array.isArray(order.attendees_json)) {
                            attendees = order.attendees_json
                        }
                    }
                } catch (e) {
                    logger.error(`${HOOK_NAME}: Failed to parse attendees_json for order ${orderId}: ${e}`)
                    continue
                }

                if (attendees.length === 0) {
                    logger.error(`${HOOK_NAME}: No attendees found for order ${orderId}`)
                    continue
                }

                // Hard limit check: verify ticket limit before creating tickets
                if (conference.ticket_max_quantity !== null && conference.ticket_max_quantity !== undefined) {
                    const existingTickets = await ticketsService.readByQuery({
                        filter: {
                            conference: { _eq: order.conference },
                            status: { _neq: 'cancelled' },
                        },
                        aggregate: { count: ['id'] },
                    })
                    const currentCount = Number(existingTickets?.[0]?.count?.id ?? 0)
                    if (currentCount + attendees.length > conference.ticket_max_quantity) {
                        logger.error(
                            `${HOOK_NAME}: Ticket limit exceeded for conference ${order.conference}. ` +
                            `Current: ${currentCount}, requested: ${attendees.length}, limit: ${conference.ticket_max_quantity}. ` +
                            `Marking order ${orderId} as cancelled.`
                        )
                        await ordersService.updateOne(orderId, { status: 'cancelled' })
                        continue
                    }
                }


                const pricePerTicket = Math.round((order.total_cents || 0) / attendees.length)
                const purchaserName = `${order.purchaser_first_name} ${order.purchaser_last_name}`

                // --- Generate invoice ---
                const conferenceYear = new Date(conference.start_on).getFullYear()
                const invoiceNumber = await generateInvoiceNumber(ordersService, conferenceYear)

                const now = new Date()
                const invoiceDate = now.toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                })

                const grossPerTicket = Math.round((order.total_gross_cents || 0) / attendees.length)

                const invoiceData: InvoiceData = {
                    invoiceNumber,
                    invoiceDate,
                    purchaserName,
                    purchaserEmail: order.purchaser_email,
                    companyName: order.company_name,
                    companyVatId: order.company_vat_id,
                    billingAddressLine1: order.billing_address_line1,
                    billingAddressLine2: order.billing_address_line2,
                    billingCity: order.billing_city,
                    billingPostalCode: order.billing_postal_code,
                    billingCountry: order.billing_country,
                    conferenceTitle: conference.title,
                    ticketType: ticketTypeLabel(order.ticket_type),
                    ticketCount: attendees.length,
                    unitPriceGrossCents: grossPerTicket,
                    subtotalCents: order.subtotal_cents || order.total_cents,
                    discountAmountCents: order.discount_amount_cents || 0,
                    vatAmountCents: order.vat_amount_cents || 0,
                    totalGrossCents: order.total_gross_cents || order.total_cents,
                }

                logger.info(`${HOOK_NAME}: Generating invoice ${invoiceNumber} for order ${order.order_number}`)
                const pdfBuffer = await generateInvoicePdf(invoiceData)

                // Upload PDF to Directus files
                const filesService = new FilesService({
                    accountability: { admin: true },
                    schema,
                })

                const invoiceFileName = `Rechnung-${invoiceNumber}.pdf`
                const storageLocation = env.STORAGE_LOCATIONS?.split(',')[0]

                const pdfStream = Readable.from([pdfBuffer])
                const fileId = await filesService.uploadOne(pdfStream, {
                    type: 'application/pdf',
                    filename_download: invoiceFileName,
                    title: `Rechnung ${invoiceNumber}`,
                    ...(storageLocation && { storage: storageLocation }),
                })

                // Update order with invoice number and file reference
                await ordersService.updateOne(orderId, {
                    invoice_number: invoiceNumber,
                    invoice_file: fileId,
                })

                logger.info(`${HOOK_NAME}: Invoice ${invoiceNumber} generated and stored (file: ${fileId})`)

                // --- Create individual tickets with profile tokens (no QR codes yet) ---
                const ticketRecords: Array<{
                    attendeeName: string
                    attendeeEmail: string
                    ticketCode: string
                    profileToken: string
                }> = []

                for (const attendee of attendees) {
                    const ticketCode = await generateUniqueTicketCode(ticketsService)
                    const profileToken = randomUUID()

                    // Create ticket in database with pending profile
                    await ticketsService.createOne({
                        ticket_code: ticketCode,
                        order: orderId,
                        conference: order.conference,
                        attendee_first_name: attendee.firstName,
                        attendee_last_name: attendee.lastName,
                        attendee_email: attendee.email,
                        ticket_type: order.ticket_type,
                        price_cents: pricePerTicket,
                        status: 'valid',
                        profile_token: profileToken,
                        profile_status: 'pending',
                    })

                    ticketRecords.push({
                        attendeeName: `${attendee.firstName} ${attendee.lastName}`,
                        attendeeEmail: attendee.email,
                        ticketCode,
                        profileToken,
                    })

                    logger.info(`${HOOK_NAME}: Created ticket ${ticketCode} for ${attendee.email} (profile pending)`)
                }

                // --- Send purchaser confirmation email with invoice PDF ---
                const totalAmount = formatPrice(order.total_gross_cents || order.total_cents)

                await sendTemplatedEmail(
                    {
                        templateKey: 'ticket_order_confirmation',
                        to: order.purchaser_email,
                        cc: order.billing_email || undefined,
                        data: {
                            purchaser_name: purchaserName,
                            conference_title: conference.title,
                            order_number: order.order_number,
                            total_amount: totalAmount,
                            ticket_count: ticketRecords.length,
                            invoice_number: invoiceNumber,
                        },
                        attachments: [
                            {
                                filename: invoiceFileName,
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                            },
                        ],
                    },
                    context
                )

                logger.info(`${HOOK_NAME}: Sent confirmation email with invoice to ${order.purchaser_email}`)

                // --- Send profile invitation email to all attendees ---
                for (const ticket of ticketRecords) {
                    const portalUrl = `${websiteUrl}/ticket-portal?token=${encodeURIComponent(ticket.profileToken)}`

                    await sendTemplatedEmail(
                        {
                            templateKey: 'ticket_profile_invitation',
                            to: ticket.attendeeEmail,
                            data: {
                                attendee_name: ticket.attendeeName,
                                conference_title: conference.title,
                                portal_url: portalUrl,
                                purchaser_name: purchaserName,
                            },
                        },
                        context
                    )

                    logger.info(`${HOOK_NAME}: Sent profile invitation to ${ticket.attendeeEmail}`)
                }

                logger.info(
                    `${HOOK_NAME}: Order ${order.order_number} processed with ${ticketRecords.length} tickets, invoice ${invoiceNumber}`
                )
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing order: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
