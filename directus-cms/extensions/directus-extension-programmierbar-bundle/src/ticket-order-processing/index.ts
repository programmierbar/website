import { defineHook } from '@directus/extensions-sdk'
import QRCode from 'qrcode'
import { sendTemplatedEmail, getSetting, type EmailServiceContext } from '../shared/email-service.js'

const HOOK_NAME = 'ticket-order-processing'

/**
 * Generate a unique ticket code
 */
function generateTicketCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoiding ambiguous chars
    let code = 'TKT-'
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

/**
 * Generate a unique ticket code with retry logic to avoid collisions
 */
async function generateUniqueTicketCode(
    ticketsService: any,
    maxRetries: number = 5
): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const code = generateTicketCode()
        // Check if code already exists
        const existing = await ticketsService.readByQuery({
            filter: { ticket_code: { _eq: code } },
            limit: 1,
        })
        if (!existing || existing.length === 0) {
            return code
        }
    }
    // If all retries fail, add timestamp for guaranteed uniqueness
    const timestamp = Date.now().toString(36).toUpperCase()
    return `TKT-${timestamp}`
}

/**
 * Generate QR code as base64 data URL for embedding in emails
 */
async function generateQRCodeDataUrl(ticketCode: string, websiteUrl: string): Promise<string> {
    const verifyUrl = `${websiteUrl}/ticket/${ticketCode}`
    try {
        return await QRCode.toDataURL(verifyUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        })
    } catch (err) {
        // Fallback: return empty string if QR generation fails
        console.error('Failed to generate QR code:', err)
        return ''
    }
}

/**
 * Format price in Euro
 */
function formatPrice(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100)
}

/**
 * Build the HTML for the ticket list (to be inserted into the template)
 */
function buildTicketListHtml(
    tickets: Array<{
        attendeeName: string
        attendeeEmail: string
        ticketCode: string
        qrCodeDataUrl: string
    }>
): string {
    return tickets
        .map(
            (ticket) => `
        <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #00A1FF;">${ticket.attendeeName}</h3>
            <p style="margin: 5px 0; color: #666;">Ticket-Code: <strong>${ticket.ticketCode}</strong></p>
            <p style="margin: 5px 0; color: #666;">E-Mail: ${ticket.attendeeEmail}</p>
            ${ticket.qrCodeDataUrl ? `
            <div style="text-align: center; margin-top: 15px;">
                <img src="${ticket.qrCodeDataUrl}" alt="QR Code" style="width: 200px; height: 200px;" />
            </div>
            ` : ''}
            <p style="text-align: center; font-size: 12px; color: #999;">
                Bitte zeige diesen QR-Code oder den Ticket-Code beim Check-in vor.
            </p>
        </div>
    `
        )
        .join('')
}

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema
    const ItemsService = services.ItemsService

    // Check if MailService is available
    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. Email notifications will not work.`)
        logger.warn(`${HOOK_NAME}: Make sure Directus email is configured in .env (EMAIL_TRANSPORT, etc.)`)
    }

    /**
     * Process order when status changes to 'paid'
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

                // Get order details
                const order = await ordersService.readOne(orderId, {
                    fields: [
                        'id',
                        'order_number',
                        'conference',
                        'purchaser_first_name',
                        'purchaser_last_name',
                        'purchaser_email',
                        'total_cents',
                        'total_gross_cents',
                        'attendees_json',
                        'ticket_type',
                    ],
                })

                if (!order) {
                    logger.error(`${HOOK_NAME}: Order ${orderId} not found`)
                    continue
                }

                // Get conference title
                const conference = await conferencesService.readOne(order.conference, {
                    fields: ['title'],
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

                // Create individual tickets
                const ticketRecords: Array<{
                    attendeeName: string
                    attendeeEmail: string
                    ticketCode: string
                    qrCodeDataUrl: string
                }> = []

                const pricePerTicket = Math.round((order.total_cents || 0) / attendees.length)

                for (const attendee of attendees) {
                    const ticketCode = await generateUniqueTicketCode(ticketsService)
                    const qrCodeDataUrl = await generateQRCodeDataUrl(ticketCode, websiteUrl)

                    // Create ticket in database
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
                    })

                    ticketRecords.push({
                        attendeeName: `${attendee.firstName} ${attendee.lastName}`,
                        attendeeEmail: attendee.email,
                        ticketCode,
                        qrCodeDataUrl,
                    })

                    logger.info(`${HOOK_NAME}: Created ticket ${ticketCode} for ${attendee.email}`)
                }

                // Send confirmation email to purchaser using template
                const purchaserName = `${order.purchaser_first_name} ${order.purchaser_last_name}`
                const ticketListHtml = buildTicketListHtml(ticketRecords)
                const totalAmount = formatPrice(order.total_gross_cents || order.total_cents)

                await sendTemplatedEmail(
                    {
                        templateKey: 'ticket_order_confirmation',
                        to: order.purchaser_email,
                        data: {
                            purchaser_name: purchaserName,
                            conference_title: conference.title,
                            order_number: order.order_number,
                            total_amount: totalAmount,
                            ticket_list_html: ticketListHtml,
                        },
                    },
                    context
                )

                logger.info(`${HOOK_NAME}: Sent confirmation email to purchaser ${order.purchaser_email}`)

                // Send individual emails to attendees (if different from purchaser)
                for (const ticket of ticketRecords) {
                    if (ticket.attendeeEmail.toLowerCase() !== order.purchaser_email.toLowerCase()) {
                        await sendTemplatedEmail(
                            {
                                templateKey: 'ticket_order_attendee',
                                to: ticket.attendeeEmail,
                                data: {
                                    attendee_name: ticket.attendeeName,
                                    conference_title: conference.title,
                                    ticket_code: ticket.ticketCode,
                                    qr_code_data_url: ticket.qrCodeDataUrl,
                                },
                            },
                            context
                        )

                        logger.info(`${HOOK_NAME}: Sent ticket email to attendee ${ticket.attendeeEmail}`)
                    }
                }

                logger.info(
                    `${HOOK_NAME}: Order ${order.order_number} completed successfully with ${ticketRecords.length} tickets`
                )
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing order: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
