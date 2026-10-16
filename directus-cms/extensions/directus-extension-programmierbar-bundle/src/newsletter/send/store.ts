import { ISSUES_COLLECTION } from '../loadIssue.ts'
import type { QueuedSend, ScheduledIssue, SendingIssue, SendStatus, SendStore, Subscriber } from './run.ts'

export const SENDS_COLLECTION = 'newsletter_sends'
export const SUBSCRIBERS_COLLECTION = 'newsletter_subscribers'
export const SETTINGS_COLLECTION = 'newsletter_settings'

interface StoreContext {
    services: { ItemsService: any }
    getSchema: () => Promise<unknown>
    /** Directus' knex instance (`context.database`), used for the atomic claims. */
    database: any
}

/**
 * The Directus-backed {@link SendStore}. Reads and ordinary writes go through
 * `ItemsService` without accountability (system writes, which the scheduling hook
 * allows). The three state claims are conditional `UPDATE … WHERE status = …` statements
 * via knex, so they are atomic even if two Directus processes ran the job at once: only
 * one of them sees an affected row.
 *
 * `sent_at` / `scheduled_at` are `timestamp` (timestamptz) fields, so instants are written
 * and compared as ISO strings in UTC (`toISOString()`); the daily-limit window starts at
 * Berlin midnight (see `berlinDayStart`).
 *
 * Rows are claimed queued → sent BEFORE the mail goes out (at most once): if the process
 * dies in between, a recipient may miss the issue, but never gets it twice.
 */
export function createDirectusSendStore({ services, getSchema, database }: StoreContext): SendStore {
    const items = async (collection: string) =>
        new services.ItemsService(collection, { schema: await getSchema(), accountability: null })

    return {
        async getDailyLimit() {
            const settings = await (
                await items(SETTINGS_COLLECTION)
            ).readSingleton({
                fields: ['daily_sending_limit'],
            })
            const limit = settings?.daily_sending_limit
            return Number.isInteger(limit) && limit >= 0 ? limit : null
        },

        async findScheduledIssues(): Promise<ScheduledIssue[]> {
            return (await items(ISSUES_COLLECTION)).readByQuery({
                filter: { status: { _eq: 'scheduled' } },
                fields: ['id', 'scheduled_at'],
                sort: ['scheduled_at'],
                limit: -1,
            })
        },

        async claimIssue(issueId) {
            const changed = await database(ISSUES_COLLECTION)
                .where({ id: issueId, status: 'scheduled' })
                .update({ status: 'sending' })
            return changed === 1
        },

        async resetIssueToDraft(issueId) {
            await (await items(ISSUES_COLLECTION)).updateOne(issueId, { status: 'draft' })
        },

        async saveSnapshot(issueId, html) {
            await (await items(ISSUES_COLLECTION)).updateOne(issueId, { html_snapshot: html })
        },

        async confirmedSubscriberIds() {
            const rows = await (
                await items(SUBSCRIBERS_COLLECTION)
            ).readByQuery({
                filter: { status: { _eq: 'confirmed' } },
                fields: ['id'],
                limit: -1,
            })
            return rows.map((row: { id: string }) => row.id)
        },

        async queueSends(issueId, subscriberIds) {
            const sends = await items(SENDS_COLLECTION)
            const existing = await sends.readByQuery({
                filter: { issue: { _eq: issueId } },
                fields: ['subscriber'],
                limit: -1,
            })
            const known = new Set(existing.map((row: { subscriber: string }) => row.subscriber))
            let created = 0
            for (const subscriberId of subscriberIds) {
                if (known.has(subscriberId)) continue
                try {
                    await sends.createOne({
                        issue: issueId,
                        subscriber: subscriberId,
                        status: 'queued',
                        dedupe_key: `${issueId}:${subscriberId}`,
                    })
                    created++
                } catch (error: any) {
                    // The unique dedupe_key is the database-level guard against double rows.
                    if (error?.code !== 'RECORD_NOT_UNIQUE') throw error
                }
            }
            return created
        },

        async findSendingIssues(): Promise<SendingIssue[]> {
            return (await items(ISSUES_COLLECTION)).readByQuery({
                filter: { status: { _eq: 'sending' } },
                fields: ['id', 'subject', 'html_snapshot'],
                sort: ['scheduled_at'],
                limit: -1,
            })
        },

        async getIssueStatus(issueId) {
            const issue = await (await items(ISSUES_COLLECTION)).readOne(issueId, { fields: ['status'] })
            return issue?.status ?? null
        },

        async countSentSince(since) {
            const rows = await (
                await items(SENDS_COLLECTION)
            ).readByQuery({
                filter: { status: { _eq: 'sent' }, sent_at: { _gte: since.toISOString() } },
                aggregate: { count: ['id'] },
            })
            return Number(rows?.[0]?.count?.id ?? 0)
        },

        async nextQueued(issueId, limit): Promise<QueuedSend[]> {
            return (await items(SENDS_COLLECTION)).readByQuery({
                filter: { issue: { _eq: issueId }, status: { _eq: 'queued' } },
                fields: ['id', 'subscriber'],
                sort: ['date_created', 'id'],
                limit,
            })
        },

        async getSubscriber(subscriberId): Promise<Subscriber | null> {
            try {
                return await (
                    await items(SUBSCRIBERS_COLLECTION)
                ).readOne(subscriberId, {
                    fields: ['email', 'status', 'unsubscribe_token'],
                })
            } catch {
                return null
            }
        },

        async claimSend(sendId, sentAt) {
            const changed = await database(SENDS_COLLECTION)
                .where({ id: sendId, status: 'queued' })
                .update({ status: 'sent', sent_at: sentAt.toISOString() })
            return changed === 1
        },

        async markSend(sendId, status, error) {
            await (await items(SENDS_COLLECTION)).updateOne(sendId, { status, error, sent_at: null })
        },

        async countByStatus(issueId) {
            const rows = await (
                await items(SENDS_COLLECTION)
            ).readByQuery({
                filter: { issue: { _eq: issueId } },
                fields: ['status'],
                limit: -1,
            })
            const counts: Record<SendStatus, number> = { queued: 0, sent: 0, failed: 0, prevented: 0 }
            for (const row of rows as Array<{ status: SendStatus }>) {
                if (row.status in counts) counts[row.status]++
            }
            return counts
        },

        async finishIssue(issueId, sentAt) {
            const changed = await database(ISSUES_COLLECTION)
                .where({ id: issueId, status: 'sending' })
                .update({ status: 'sent', sent_at: sentAt.toISOString() })
            return changed === 1
        },
    }
}
