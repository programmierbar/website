import { defineHook } from '@directus/extensions-sdk'
import { sendTemplatedEmail, getSetting, type EmailServiceContext } from '../shared/email-service.js'
import { generateQRCodeBuffer } from '../shared/ticket-utils.js'
import {
    generateAppleWalletPass,
    generateGoogleWalletUrl,
    type WalletPassInput,
} from '../shared/wallet-pass-generator.js'

const HOOK_NAME = 'ticket-profile-completion'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema
    const env = hookContext.env
    const ItemsService = services.ItemsService

    // Check if MailService is available
    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. Email notifications will not work.`)
    }

    /**
     * Send final ticket email with QR code and wallet passes when profile_status changes to 'completed'
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
            const venueName = await getSetting('conference_venue_name', context)
            const venueAddress = await getSetting('conference_venue_address', context)

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
                        'profile_token',
                    ],
                })

                if (!ticket) {
                    logger.error(`${HOOK_NAME}: Ticket ${ticketId} not found`)
                    continue
                }

                const conference = await conferencesService.readOne(ticket.conference, {
                    fields: ['title', 'start_on', 'end_on'],
                })

                if (!conference) {
                    logger.error(`${HOOK_NAME}: Conference ${ticket.conference} not found`)
                    continue
                }

                // Generate QR code as buffer for CID embedding
                const qrCodeBuffer = await generateQRCodeBuffer(ticket.ticket_code, websiteUrl)
                const attendeeName = `${ticket.attendee_first_name} ${ticket.attendee_last_name}`
                const qrCid = `qrcode-${ticket.ticket_code}@programmier.bar`

                // Generate wallet passes
                const walletInput: WalletPassInput = {
                    ticketCode: ticket.ticket_code,
                    attendeeName,
                    attendeeEmail: ticket.attendee_email,
                    conferenceTitle: conference.title,
                    conferenceDate: conference.start_on,
                    conferenceEndDate: conference.end_on,
                    venueName: venueName || undefined,
                    venueAddress: venueAddress || undefined,
                    websiteUrl,
                }

                const attachments = [
                    {
                        filename: `qrcode-${ticket.ticket_code}.png`,
                        content: qrCodeBuffer,
                        contentType: 'image/png',
                        cid: qrCid,
                    },
                ]

                // Apple Wallet: attach .pkpass to email + provide download URL
                let appleWalletUrl: string | null = null
                try {
                    const applePassBuffer = await generateAppleWalletPass(walletInput, env)
                    if (applePassBuffer) {
                        attachments.push({
                            filename: `${ticket.ticket_code}.pkpass`,
                            content: applePassBuffer,
                            contentType: 'application/vnd.apple.pkpass',
                            cid: '',
                        })
                        const directusUrl = (env.PUBLIC_URL || '').replace(/\/+$/, '')
                        const tokenParam = encodeURIComponent(ticket.profile_token)
                        appleWalletUrl = `${directusUrl}/ticket-wallet/apple/${ticket.ticket_code}?token=${tokenParam}`
                    }
                } catch (err: any) {
                    logger.warn(`${HOOK_NAME}: Apple Wallet pass generation failed: ${err?.message || err}`)
                }

                // Google Wallet: generate "Add to Wallet" URL
                let googleWalletUrl: string | null = null
                try {
                    googleWalletUrl = generateGoogleWalletUrl(walletInput, env)
                } catch (err: any) {
                    logger.warn(`${HOOK_NAME}: Google Wallet URL generation failed: ${err?.message || err}`)
                }

                // Send final ticket email with QR code and wallet links
                await sendTemplatedEmail(
                    {
                        templateKey: 'ticket_profile_completed',
                        to: ticket.attendee_email,
                        data: {
                            attendee_name: attendeeName,
                            conference_title: conference.title,
                            ticket_code: ticket.ticket_code,
                            qr_code_cid: qrCid,
                            apple_wallet_url: appleWalletUrl || '',
                            google_wallet_url: googleWalletUrl || '',
                        },
                        attachments,
                    },
                    context
                )

                logger.info(
                    `${HOOK_NAME}: Sent final ticket email to ${ticket.attendee_email} (${ticket.ticket_code})` +
                        `${appleWalletUrl ? ' +Apple' : ''}${googleWalletUrl ? ' +Google' : ''}`
                )
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing profile completion: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
