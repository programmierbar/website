/**
 * Rules for writes to `newsletter_issues`, enforced by the `newsletter-scheduling`
 * filter hook. Pure, so the create and update paths are tested without Directus.
 *
 * Editors schedule an issue themselves (status `scheduled` + `scheduled_at`, like
 * podcasts); the mass-send cron does the rest. Writes without accountability are the
 * cron's own (system) writes and are always allowed.
 */

/** Statuses only the send job sets. */
export const SYSTEM_STATUSES = ['sending', 'sent']

/** Fields that make up the mail; frozen once the send has started. */
export const CONTENT_FIELDS = ['subject', 'preheader', 'blocks', 'scheduled_at']

export interface IssueState {
    status: string | null
    subject: string | null
    scheduled_at: string | null
    /** Number of rows in the `blocks` M2A. */
    blockCount: number
}

/**
 * Block count after a write. Directus accepts an M2A value either as the full list
 * (array) or as a change set `{ create, update, delete }`.
 */
export function blockCountAfter(existingCount: number, blocks: unknown): number {
    if (blocks === undefined) {
        return existingCount
    }
    if (Array.isArray(blocks)) {
        return blocks.length
    }
    if (blocks && typeof blocks === 'object') {
        const changes = blocks as { create?: unknown[]; delete?: unknown[] }
        const created = Array.isArray(changes.create) ? changes.create.length : 0
        const deleted = Array.isArray(changes.delete) ? changes.delete.length : 0
        return Math.max(0, existingCount + created - deleted)
    }
    return 0
}

/**
 * The error message for a disallowed write, or null when it may proceed.
 *
 * @param payload The fields being written.
 * @param existing The stored issue (null on create).
 * @param isSystem True for writes without accountability (the send job).
 */
export function checkIssueWrite(
    payload: Record<string, unknown>,
    existing: IssueState | null,
    isSystem: boolean
): string | null {
    if (isSystem) {
        return null
    }

    if ('html_snapshot' in payload) {
        return 'Der HTML-Snapshot wird nur vom Versand geschrieben.'
    }

    const nextStatus = 'status' in payload ? (payload.status as string | null) : (existing?.status ?? null)
    if (nextStatus && SYSTEM_STATUSES.includes(nextStatus) && nextStatus !== existing?.status) {
        return 'Die Status „sending“ und „sent“ setzt nur der Versand. Zum Versenden „scheduled“ und einen Versandzeitpunkt wählen.'
    }

    if (existing?.status && SYSTEM_STATUSES.includes(existing.status)) {
        const touched = CONTENT_FIELDS.filter((field) => field in payload)
        if (touched.length > 0) {
            return `Die Ausgabe wird bereits versendet oder ist versendet – ${touched.join(', ')} kann nicht mehr geändert werden.`
        }
    }

    if (nextStatus === 'scheduled') {
        const subject = 'subject' in payload ? payload.subject : existing?.subject
        const scheduledAt = 'scheduled_at' in payload ? payload.scheduled_at : existing?.scheduled_at
        const blockCount = blockCountAfter(existing?.blockCount ?? 0, payload.blocks)
        const missing: string[] = []
        if (typeof subject !== 'string' || !subject.trim()) missing.push('Betreff')
        if (!scheduledAt) missing.push('Versandzeitpunkt (scheduled_at)')
        if (blockCount < 1) missing.push('mindestens ein Block')
        if (missing.length > 0) {
            return `Zum Einplanen fehlt: ${missing.join(', ')}.`
        }
    }

    return null
}
