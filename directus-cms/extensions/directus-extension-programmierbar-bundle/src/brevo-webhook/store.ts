import { SENDS_COLLECTION, SUBSCRIBERS_COLLECTION } from '../newsletter/send/store.ts'
import type { WebhookStore } from './process.ts'

interface StoreContext {
    /** Directus' knex instance (`context.database`). */
    database: any
}

/** States a webhook event may move a subscriber out of. The others are final for it. */
export const TRANSITIONABLE_STATUSES = ['pending', 'confirmed']

/**
 * The Directus-backed {@link WebhookStore}. Both writes are ONE conditional
 * `UPDATE … WHERE …` statement via knex, the same mechanism as the send job's claims
 * (`newsletter/send/store.ts`). `ItemsService.updateByQuery` would not do: it resolves the
 * filter to keys first and then updates by primary key, so a confirm or unsubscribe landing
 * in between could be overwritten by a bounce (or the other way round). Here the guard is
 * evaluated by the database in the same statement as the write.
 *
 * What bypassing `ItemsService` means:
 * - `date_updated` is not set by Directus, so it is written here, in the same statement —
 *   it doubles as the time of the bounce / complaint (there is no field of its own).
 *   `user_updated` is left as it is; this is a system write without a user.
 * - No `items.update` action fires. Nothing needs one: the double-opt-in hook reacts only
 *   to a new `confirm_token` / window, and no hook listens on `newsletter_sends` updates.
 * - No activity/revision entry, and the Directus data cache is not cleared (`CACHE_ENABLED`
 *   is off, as for the send job's claims).
 */
export function createDirectusWebhookStore({ database }: StoreContext): WebhookStore {
    return {
        async transitionSubscriber(email, to, now) {
            const at = now.toISOString()
            // `unsubscribed_at` is set like the website's opt-out does.
            const data = to === 'unsubscribed' ? { status: to, unsubscribed_at: at } : { status: to }
            const changed = await database(SUBSCRIBERS_COLLECTION)
                .where({ email })
                .whereIn('status', TRANSITIONABLE_STATUSES)
                .update({ ...data, date_updated: at })
            return changed > 0
        },

        async noteSend(sendId, note, now) {
            // The row stays `sent`: the mail was handed to Brevo and counts against the daily
            // limit. `failed` means the hand-over itself failed (see newsletter-mass-send).
            const changed = await database(SENDS_COLLECTION)
                .where({ id: sendId, status: 'sent' })
                .whereNull('error')
                .update({ error: note, date_updated: now.toISOString() })
            return changed > 0
        },
    }
}
