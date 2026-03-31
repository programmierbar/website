import {
    createDirectus,
    rest,
    staticToken,
    readItem,
    readItems,
    readSingleton,
    createItem,
    updateItem,
    deleteItem,
    uploadFiles,
} from '@directus/sdk'

import type { Collections } from '~/services/directus'
import type { DirectusTicketSettingsItem, DirectusTicketOrderItem, DirectusTicketItem } from '~/types/directus'

export function useAuthenticatedDirectus() {
    const config = useRuntimeConfig()
    const apiToken = config.directusApiToken

    if (!apiToken) {
        throw createError({
            statusCode: 500,
            message: 'NUXT_DIRECTUS_API_TOKEN not configured',
        })
    }

    const client = createDirectus<Collections>(config.public.directusCmsUrl).with(staticToken(apiToken)).with(rest())

    async function getSpeakerByPortalToken(token: string) {
        const speakers = await client.request(
            readItems('speakers', {
                filter: { portal_token: { _eq: token } },
                fields: [
                    'id',
                    'first_name',
                    'last_name',
                    'academic_title',
                    'occupation',
                    'description',
                    'website_url',
                    'linkedin_url',
                    'twitter_url',
                    'bluesky_url',
                    'github_url',
                    'instagram_url',
                    'youtube_url',
                    'portal_token_expires',
                    'portal_submission_status',
                    'portal_submission_deadline',
                    'profile_image',
                    'event_image',
                ],
                limit: 1,
            })
        )

        return speakers?.[0] ?? null
    }

    // Accepts string IDs for relational file fields (profile_image, event_image)
    // which differ from the read type (DirectusFileItem), so a cast is needed.
    async function updateSpeaker(id: string, data: Record<string, unknown>) {
        return await client.request(updateItem('speakers', id, data as any))
    }

    async function uploadFile(formData: FormData) {
        return await client.request(uploadFiles(formData))
    }

    async function getTicketSettings(): Promise<DirectusTicketSettingsItem> {
        return await client.request(
            readSingleton('ticket_settings', {
                fields: [
                    'id',
                    'early_bird_price_cents',
                    'regular_price_cents',
                    'discounted_price_cents',
                    'early_bird_deadline',
                    'discount_code',
                ],
            })
        )
    }

    async function getConference(id: string) {
        return await client.request(
            readItem('conferences', id, {
                fields: ['id', 'slug', 'title', 'ticketing_enabled'],
            })
        )
    }

    async function getTicketOrder(id: string) {
        return await client.request(
            readItem('ticket_orders', id, {
                fields: ['id', 'status'],
            })
        )
    }

    async function createTicketOrder(data: Partial<DirectusTicketOrderItem>) {
        return await client.request(createItem('ticket_orders', data))
    }

    async function updateTicketOrder(
        id: string,
        data: Partial<DirectusTicketOrderItem>,
        query?: { filter: Record<string, unknown> }
    ) {
        return await client.request(updateItem('ticket_orders', id, data, query))
    }

    async function deleteTicketOrder(id: string) {
        return await client.request(deleteItem('ticket_orders', id))
    }

    async function getTicketByProfileToken(token: string) {
        const tickets = await client.request(
            readItems('tickets', {
                filter: { profile_token: { _eq: token } },
                fields: [
                    'id',
                    'ticket_code',
                    'order',
                    'conference',
                    'attendee_first_name',
                    'attendee_last_name',
                    'attendee_email',
                    'profile_status',
                    'job_title',
                    'company',
                    'dietary_preferences',
                    'pronouns',
                    'tshirt_size',
                    'last_event_visited',
                    'heard_about_from',
                    'additional_notes',
                ],
                limit: 1,
            })
        )

        return tickets?.[0] ?? null
    }

    async function updateTicket(id: string, data: Partial<DirectusTicketItem>) {
        return await client.request(updateItem('tickets', id, data as any))
    }

    async function getTicketsByOrderId(orderId: string) {
        return await client.request(
            readItems('tickets', {
                filter: { order: { _eq: orderId } },
                fields: ['id', 'profile_token', 'profile_status'],
            })
        )
    }

    async function getTicketOrderBySessionId(sessionId: string) {
        const orders = await client.request(
            readItems('ticket_orders', {
                filter: { stripe_checkout_session_id: { _eq: sessionId } },
                fields: ['id', 'status'],
                limit: 1,
            })
        )

        return orders?.[0] ?? null
    }

    return {
        getSpeakerByPortalToken,
        updateSpeaker,
        uploadFile,
        getTicketSettings,
        getConference,
        getTicketOrder,
        createTicketOrder,
        updateTicketOrder,
        deleteTicketOrder,
        getTicketByProfileToken,
        updateTicket,
        getTicketsByOrderId,
        getTicketOrderBySessionId,
    }
}
