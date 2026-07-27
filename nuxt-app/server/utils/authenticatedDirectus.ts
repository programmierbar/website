import { randomUUID } from 'node:crypto'
import {
    aggregate,
    createDirectus,
    createItem,
    deleteItem,
    readItem,
    readItems,
    rest,
    staticToken,
    updateItem,
    updateItems,
    uploadFiles,
} from '@directus/sdk'
import type { Collections } from '~/services/directus'
import type {
    DirectusNewsletterSubscriberItem,
    DirectusTicketDiscountCodeItem,
    DirectusTicketItem,
    DirectusTicketOrderItem,
} from '~/types/directus'

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
                fields: ['id', 'conference', 'code', 'price_cents', 'label', 'max_uses', 'active', 'is_employee_code'],
            })
        )
        const upperCode = code.toUpperCase()
        const match = (codes as DirectusTicketDiscountCodeItem[])?.find((c) => c.code.toUpperCase() === upperCode)
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
                        is_internal: { _neq: true },
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
                        is_internal: { _neq: true },
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

    async function createNewsletterSubscriber(data: Partial<DirectusNewsletterSubscriberItem>) {
        return await client.request(createItem('newsletter_subscribers', data))
    }

    // Looks a subscriber up by its confirm token alone. Status and expiry are
    // evaluated by the caller so it can distinguish confirmed / expired /
    // invalid — a status+expiry-filtered query could not tell those apart.
    async function readNewsletterSubscriberByToken(token: string) {
        const subscribers = await client.request(
            readItems('newsletter_subscribers', {
                filter: { confirm_token: { _eq: token } },
                fields: ['id', 'status', 'confirm_token_expires_at', 'confirmed_at'],
                limit: 1,
            })
        )

        return subscribers?.[0] ?? null
    }

    // Marks a pending subscriber confirmed. `confirm_token` is intentionally not
    // cleared (it is NOT NULL); the link is neutralised via status + expiry.
    //
    // The write is guarded by the state we read a moment ago (`status` still
    // pending, `confirm_token` still the one from the link) rather than writing
    // blindly by id, so a change that landed in between — an unsubscribe, or a
    // concurrent confirm — is not clobbered. Returns whether a row was actually
    // written, letting the caller answer from what happened instead of from its
    // own possibly-stale read.
    //
    // NB: this narrows the read-to-write window, it does not eliminate it.
    // Directus resolves a filtered update to keys first and then updates by
    // primary key (`ItemsService.updateByQuery`), so it is not a single atomic
    // compare-and-swap. A true CAS needs one `UPDATE … WHERE …` statement,
    // which is only reachable with direct DB access (i.e. inside the CMS).
    async function confirmNewsletterSubscriber(id: string, expectedToken: string) {
        const updated = await client.request(
            updateItems(
                'newsletter_subscribers',
                {
                    filter: {
                        id: { _eq: id },
                        status: { _eq: 'pending' },
                        confirm_token: { _eq: expectedToken },
                    },
                },
                {
                    status: 'confirmed',
                    confirmed_at: new Date().toISOString(),
                }
            )
        )

        return (updated?.length ?? 0) > 0
    }

    // Refreshes an expired pending subscriber's confirmation by issuing a NEW
    // token, so the just-clicked expired link can't later confirm on a page
    // refresh. The token rotation is also the signal the CMS `newsletter-double-
    // opt-in` hook keys off: its update filter stamps the matching
    // `confirm_token_expires_at`, and its update action mails the new link.
    //
    // The expiry is deliberately NOT set here — the confirmation TTL is defined
    // once, in the CMS hook, so the create and refresh paths can't drift apart.
    //
    // Guarded like `confirmNewsletterSubscriber` above, and for a sharper reason:
    // every rotation triggers a mail, and only the newest token still works. Two
    // concurrent requests writing blindly would send two mails of which the
    // first contains a dead link. With the guard the loser writes nothing, so
    // exactly one mail goes out. Same caveat about the residual window applies.
    async function refreshNewsletterConfirmation(id: string, expectedToken: string) {
        const updated = await client.request(
            updateItems(
                'newsletter_subscribers',
                {
                    filter: {
                        id: { _eq: id },
                        status: { _eq: 'pending' },
                        confirm_token: { _eq: expectedToken },
                        // Don't shorten a window someone else just refreshed.
                        confirm_token_expires_at: { _lte: new Date().toISOString() },
                    },
                },
                { confirm_token: randomUUID() }
            )
        )

        return (updated?.length ?? 0) > 0
    }

    // Looks a subscriber up by its (permanent) unsubscribe token. As with the
    // confirm token, the status is evaluated by the caller so it can tell an
    // already-unsubscribed address from an unusable link.
    async function readNewsletterSubscriberByUnsubscribeToken(token: string) {
        const subscribers = await client.request(
            readItems('newsletter_subscribers', {
                filter: { unsubscribe_token: { _eq: token } },
                fields: ['id', 'status', 'unsubscribed_at'],
                limit: 1,
            })
        )

        return subscribers?.[0] ?? null
    }

    // Opts a subscriber out, from any state that isn't already 'unsubscribed' —
    // a `pending` address that never confirmed can opt out too, which also stops
    // the confirmation resends.
    //
    // Guarded on the token and on not-already-unsubscribed like the confirm
    // writes above, so `unsubscribed_at` keeps the timestamp of the first opt-out
    // instead of being pushed forward by every re-click. Same caveat about the
    // residual read-to-write window applies.
    async function unsubscribeNewsletterSubscriber(id: string, expectedToken: string) {
        const updated = await client.request(
            updateItems(
                'newsletter_subscribers',
                {
                    filter: {
                        id: { _eq: id },
                        unsubscribe_token: { _eq: expectedToken },
                        status: { _neq: 'unsubscribed' },
                    },
                },
                {
                    status: 'unsubscribed',
                    unsubscribed_at: new Date().toISOString(),
                }
            )
        )

        return (updated?.length ?? 0) > 0
    }

    // Puts a previously unsubscribed address back into the double-opt-in flow:
    // status back to 'pending' and a fresh `confirm_token`, which makes the CMS
    // hook stamp a new window and send a confirmation mail. Consent is therefore
    // re-obtained rather than assumed from the earlier signup.
    //
    // Guarded on `status = unsubscribed` so this can never reset a live
    // subscription (and so a repeat signup for a pending/confirmed address stays
    // the no-op that keeps the endpoint free of email enumeration).
    async function resubscribeNewsletterSubscriber(email: string) {
        const updated = await client.request(
            updateItems(
                'newsletter_subscribers',
                {
                    filter: {
                        email: { _eq: email },
                        status: { _eq: 'unsubscribed' },
                    },
                },
                {
                    status: 'pending',
                    confirm_token: randomUUID(),
                    confirmed_at: null,
                    unsubscribed_at: null,
                }
            )
        )

        return (updated?.length ?? 0) > 0
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
        createNewsletterSubscriber,
        readNewsletterSubscriberByToken,
        confirmNewsletterSubscriber,
        refreshNewsletterConfirmation,
        readNewsletterSubscriberByUnsubscribeToken,
        unsubscribeNewsletterSubscriber,
        resubscribeNewsletterSubscriber,
    }
}
