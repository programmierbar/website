import { defineHook } from '@directus/extensions-sdk'
import { sendTemplatedEmail, getSetting, type EmailServiceContext } from '../shared/email-service.js'
import { generateQRCodeBuffer } from '../shared/ticket-utils.js'

const HOOK_NAME = 'ticket-profile-completion'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema
    const ItemsService = services.ItemsService

    // Check if MailService is available
    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. Email notifications will not work.`)
    }

    /**
     * Send final ticket email with QR code when profile_status changes to 'completed'
     */
    action('tickets.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if profile_status is being set to 'completed'
        if (payload.profile_status !== 'completed') {
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

            const ticketsService = new ItemsService('tickets', {
                schema,
                accountability: { admin: true },
            })

            const conferencesService = new ItemsService('conferences', {
                schema,
                accountability: { admin: true },
            })

            const websiteUrl = (await getSetting('website_url', context)) || 'https://programmier.bar'

            for (const ticketId of keys) {
                logger.info(`${HOOK_NAME}: Processing completed profile for ticket ${ticketId}`)

                const ticket = await ticketsService.readOne(ticketId, {
                    fields: [
                        'id',
                        'ticket_code',
                        'conference',
                        'attendee_first_name',
                        'attendee_last_name',
                        'attendee_email',
                    ],
                })

                if (!ticket) {
                    logger.error(`${HOOK_NAME}: Ticket ${ticketId} not found`)
                    continue
                }

                const conference = await conferencesService.readOne(ticket.conference, {
                    fields: ['title'],
                })

                if (!conference) {
                    logger.error(`${HOOK_NAME}: Conference ${ticket.conference} not found`)
                    continue
                }

                // Generate QR code as buffer for CID embedding
                const qrCodeBuffer = await generateQRCodeBuffer(ticket.ticket_code, websiteUrl)
                const attendeeName = `${ticket.attendee_first_name} ${ticket.attendee_last_name}`
                const qrCid = `qrcode-${ticket.ticket_code}@programmier.bar`

                // Send final ticket email with QR code as CID attachment
                await sendTemplatedEmail(
                    {
                        templateKey: 'ticket_profile_completed',
                        to: ticket.attendee_email,
                        data: {
                            attendee_name: attendeeName,
                            conference_title: conference.title,
                            ticket_code: ticket.ticket_code,
                            qr_code_cid: qrCid,
                        },
                        attachments: [
                            {
                                filename: `qrcode-${ticket.ticket_code}.png`,
                                content: qrCodeBuffer,
                                contentType: 'image/png',
                                cid: qrCid,
                            },
                        ],
                    },
                    context
                )

                logger.info(
                    `${HOOK_NAME}: Sent final ticket email with QR code to ${ticket.attendee_email} (${ticket.ticket_code})`
                )
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing profile completion: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
