import {
    createDirectus,
    rest,
    staticToken,
    readItem,
    readItems,
    aggregate,
    createItem,
    updateItem,
    deleteItem,
    uploadFiles,
} from '@directus/sdk'
import type { Collections } from '~/services/directus'
import type { DirectusTicketOrderItem, DirectusTicketItem, DirectusTicketDiscountCodeItem } from '~/types/directus'

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

    async function getConference(id: string) {
        return await client.request(
            readItem('conferences', id, {
                fields: [
                    'id',
                    'slug',
                    'title',
                    'ticketing_enabled',
                    'ticket_early_bird_price_cents',
                    'ticket_regular_price_cents',
                    'ticket_early_bird_deadline',
                    'ticket_max_quantity',
                ],
            })
        )
    }

    async function getDiscountCode(conferenceId: string, code: string): Promise<DirectusTicketDiscountCodeItem | null> {
        const codes = await client.request(
            readItems('ticket_discount_codes', {
                filter: {
                    conference: { _eq: conferenceId },
                    active: { _eq: true },
                },
                fields: ['id', 'conference', 'code', 'price_cents', 'label', 'max_uses', 'active'],
            })
        )
        const upperCode = code.toUpperCase()
        const match = (codes as DirectusTicketDiscountCodeItem[])?.find(
            (c) => c.code.toUpperCase() === upperCode
        )
        return match ?? null
    }

    async function countPaidTicketsForConference(conferenceId: string): Promise<number> {
        const result = await client.request(
            aggregate('tickets' as any, {
                aggregate: { count: ['id'] },
                query: {
                    filter: {
                        conference: { _eq: conferenceId },
                        status: { _neq: 'cancelled' },
                    },
                },
            })
        )
        return Number(result?.[0]?.count?.id ?? 0)
    }

    async function countDiscountCodeUses(discountCodeId: string): Promise<number> {
        const result = await client.request(
            aggregate('ticket_orders' as any, {
                aggregate: { count: ['id'] },
                query: {
                    filter: {
                        discount_code_used: { _eq: discountCodeId },
                        status: { _neq: 'cancelled' },
                    },
                },
            })
        )
        return Number(result?.[0]?.count?.id ?? 0)
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

    async function getTicketByCode(ticketCode: string) {
        const tickets = await client.request(
            readItems('tickets', {
                filter: { ticket_code: { _eq: ticketCode } },
                fields: [
                    'id',
                    'ticket_code',
                    'conference',
                    'attendee_first_name',
                    'attendee_last_name',
                    'attendee_email',
                    'status',
                    'checked_in_at',
                    'ticket_type',
                ],
                limit: 1,
            })
        )

        return tickets?.[0] ?? null
    }

    async function countCheckedInTicketsForConference(conferenceId: string): Promise<number> {
        const result = await client.request(
            aggregate('tickets' as any, {
                aggregate: { count: ['id'] },
                query: {
                    filter: {
                        conference: { _eq: conferenceId },
                        status: { _eq: 'checked_in' },
                    },
                },
            })
        )
        return Number(result?.[0]?.count?.id ?? 0)
    }

    async function getLatestConferenceWithTicketing() {
        const conferences = await client.request(
            readItems('conferences', {
                filter: { ticketing_enabled: { _eq: true } },
                fields: ['id', 'title', 'slug', 'start_on', 'ticket_max_quantity'],
                sort: ['-start_on'],
                limit: 1,
            })
        )

        return conferences?.[0] ?? null
    }

    return {
        getSpeakerByPortalToken,
        updateSpeaker,
        uploadFile,
        getConference,
        getDiscountCode,
        countPaidTicketsForConference,
        countDiscountCodeUses,
        getTicketOrder,
        createTicketOrder,
        updateTicketOrder,
        deleteTicketOrder,
        getTicketByProfileToken,
        updateTicket,
        getTicketsByOrderId,
        getTicketOrderBySessionId,
        getTicketByCode,
        countCheckedInTicketsForConference,
        getLatestConferenceWithTicketing,
    }
}
