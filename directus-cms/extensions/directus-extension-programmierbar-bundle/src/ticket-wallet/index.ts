/// <reference types="@directus/extensions/api.d.ts" />
import { defineEndpoint } from '@directus/extensions-sdk'
import { generateAppleWalletPass, type WalletPassInput } from '../shared/wallet-pass-generator.js'

import type { SandboxEndpointRouter } from 'directus:api'

export default defineEndpoint(async (router: SandboxEndpointRouter, context) => {
    const logger = context.logger
    const ItemsService = context.services.ItemsService
    const env = context.env

    /**
     * GET /ticket-wallet/apple/:ticketCode?token=<profile_token>
     * Generates and serves a .pkpass file on the fly.
     */
    router.get('/apple/:ticketCode', async (req, res) => {
        const { ticketCode } = req.params
        const token = req.query.token as string

        if (!ticketCode || !token) {
            res.status(400).send({ error: 'Missing ticket code or token' })
            return
        }

        try {
            const schema = await context.getSchema()

            const ticketsService = new ItemsService('tickets', {
                schema,
                accountability: { admin: true },
            })

            const conferencesService = new ItemsService('conferences', {
                schema,
                accountability: { admin: true },
            })

            // Look up ticket by code and verify profile token
            const tickets = await ticketsService.readByQuery({
                filter: {
                    ticket_code: { _eq: ticketCode },
                    profile_token: { _eq: token },
                    profile_status: { _eq: 'completed' },
                },
                fields: [
                    'id',
                    'ticket_code',
                    'conference',
                    'attendee_first_name',
                    'attendee_last_name',
                    'attendee_email',
                ],
                limit: 1,
            })

            if (!tickets || tickets.length === 0) {
                res.status(404).send({ error: 'Ticket not found' })
                return
            }

            const ticket = tickets[0]

            const conference = await conferencesService.readOne(ticket.conference, {
                fields: ['title', 'start_on', 'end_on'],
            })

            if (!conference) {
                res.status(404).send({ error: 'Conference not found' })
                return
            }

            const settingsService = new ItemsService('automation_settings', {
                schema,
                accountability: { admin: true },
            })
            const settings = await settingsService.readByQuery({
                filter: { key: { _eq: 'website_url' } },
                fields: ['value'],
                limit: 1,
            })
            const websiteUrl = settings?.[0]?.value || 'https://programmier.bar'

            const input: WalletPassInput = {
                ticketCode: ticket.ticket_code,
                attendeeName: `${ticket.attendee_first_name} ${ticket.attendee_last_name}`,
                attendeeEmail: ticket.attendee_email,
                conferenceTitle: conference.title,
                conferenceDate: conference.start_on,
                conferenceEndDate: conference.end_on,
                websiteUrl,
            }

            const passBuffer = await generateAppleWalletPass(input, env)

            if (!passBuffer) {
                res.status(503).send({ error: 'Apple Wallet not configured' })
                return
            }

            res.set('Content-Type', 'application/vnd.apple.pkpass')
            res.set('Content-Disposition', `attachment; filename="${ticketCode}.pkpass"`)
            res.send(passBuffer)
        } catch (err: any) {
            logger.error(`ticket-wallet: Error generating pass: ${err?.message || err}`)
            res.status(500).send({ error: 'Failed to generate wallet pass' })
        }
    })
})
