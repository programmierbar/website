import { SENDS_COLLECTION, SUBSCRIBERS_COLLECTION } from '../newsletter/send/store.ts'
import type { WebhookStore } from './process.ts'

interface StoreContext {
    services: { ItemsService: any }
    getSchema: () => Promise<unknown>
}

/** States a webhook event may move a subscriber out of. The others are final for it. */
export const TRANSITIONABLE_STATUSES = ['pending', 'confirmed']

/**
 * The Directus-backed {@link WebhookStore}. Writes go through `ItemsService` without
 * accountability (system writes), so Directus maintains `date_updated` — which is the
 * time of the bounce or complaint, without an extra field.
 *
 * Both writes are `updateByQuery` with the guard in the filter: the subscriber's current
 * status, the send row's status and empty `error`. Directus resolves the filter to keys
 * and updates those, so a repeated event finds nothing to change.
 */
export function createDirectusWebhookStore({ services, getSchema }: StoreContext): WebhookStore {
    const items = async (collection: string) =>
        new services.ItemsService(collection, { schema: await getSchema(), accountability: null })

    return {
        async transitionSubscriber(email, to, now) {
            // `unsubscribed_at` is set like the website's opt-out does; bounced and complained
            // have no timestamp field of their own (see `date_updated`).
            const data = to === 'unsubscribed' ? { status: to, unsubscribed_at: now.toISOString() } : { status: to }
            const keys = await (
                await items(SUBSCRIBERS_COLLECTION)
            ).updateByQuery({ filter: { email: { _eq: email }, status: { _in: TRANSITIONABLE_STATUSES } } }, data)
            return Array.isArray(keys) && keys.length > 0
        },

        async noteSend(sendId, note) {
            // The row stays `sent`: the mail was handed to Brevo and counts against the daily
            // limit. `failed` means the hand-over itself failed (see newsletter-mass-send).
            const keys = await (
                await items(SENDS_COLLECTION)
            ).updateByQuery(
                { filter: { id: { _eq: sendId }, status: { _eq: 'sent' }, error: { _null: true } } },
                { error: note }
            )
            return Array.isArray(keys) && keys.length > 0
        },
    }
}
