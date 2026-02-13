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
import type { DirectusTicketSettingsItem, DirectusTicketOrderItem } from '~/types/directus'

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
                fields: ['id', 'slug', 'title'],
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
    }
}
