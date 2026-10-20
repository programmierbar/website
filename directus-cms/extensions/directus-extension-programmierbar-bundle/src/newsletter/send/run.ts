import { buildNewsletterTrackingHeaders } from '../brevoTracking.ts'
import { buildListUnsubscribeHeaders, buildUnsubscribeUrl } from '../unsubscribe.ts'
import { hasUnsubscribePlaceholder, personalizeSnapshot } from './snapshot.ts'
import { berlinDayKey, berlinDayStart, parseDirectusDateTime } from './time.ts'

/** At most this many mails per tick (one tick per minute), on top of the daily limit. */
export const MAX_MAILS_PER_TICK = 50

export type SendStatus = 'queued' | 'sent' | 'failed' | 'prevented'

export interface ScheduledIssue {
    id: string
    scheduled_at: string | null
}

export interface SendingIssue {
    id: string
    subject: string | null
    html_snapshot: string | null
}

export interface QueuedSend {
    id: string
    subscriber: string
}

export interface Subscriber {
    email: string
    status: string
    unsubscribe_token: string
}

/**
 * Persistence for the send job. The Directus implementation lives in `store.ts`; the
 * claims (`claimIssue`, `claimSend`, `finishIssue`) are conditional updates in the
 * database, so a second process cannot take over the same issue or row.
 */
export interface SendStore {
    getDailyLimit(): Promise<number | null>
    findScheduledIssues(): Promise<ScheduledIssue[]>
    /**
     * scheduled → sending, only if still scheduled, clearing `html_snapshot` in the same
     * update (a snapshot left from an earlier, stopped run must not count as this run's
     * "fan-out complete" marker). True if this call made the change.
     */
    claimIssue(issueId: string): Promise<boolean>
    /** sending → scheduled, only if still sending: undoes a claim on an issue that is no longer due. */
    unclaimIssue(issueId: string): Promise<void>
    /** The stored `scheduled_at` (as Directus returns it), or null. */
    getScheduledAt(issueId: string): Promise<string | null>
    /** Back to draft after a failed start, so it does not retry every minute. */
    resetIssueToDraft(issueId: string): Promise<void>
    /** Written only after the fan-out completed: a stored snapshot means all rows exist. */
    saveSnapshot(issueId: string, html: string): Promise<void>
    confirmedSubscriberIds(): Promise<string[]>
    /** One queued row per subscriber; existing ones are skipped (unique `dedupe_key`). Returns the number created. */
    queueSends(issueId: string, subscriberIds: string[]): Promise<number>
    findSendingIssues(): Promise<SendingIssue[]>
    getIssueStatus(issueId: string): Promise<string | null>
    countSentSince(since: Date): Promise<number>
    nextQueued(issueId: string, limit: number): Promise<QueuedSend[]>
    /** Null only when the subscriber no longer exists; read errors are thrown. */
    getSubscriber(subscriberId: string): Promise<Subscriber | null>
    /** queued → sent (with sent_at), only if still queued. True if this call made the change. */
    claimSend(sendId: string, sentAt: Date): Promise<boolean>
    markSend(sendId: string, status: 'failed' | 'prevented', error: string): Promise<void>
    countByStatus(issueId: string): Promise<Record<SendStatus, number>>
    /** sending → sent (with sent_at), only if still sending. */
    finishIssue(issueId: string, sentAt: Date): Promise<boolean>
}

export interface SendDeps {
    store: SendStore
    now: () => Date
    /** Render the live issue with the unsubscribe placeholder (shared renderer). */
    renderSnapshot: (
        issueId: string
    ) => Promise<{ html: string; warnings: string[]; hiddenCount: number; renderedBlocks: number }>
    getWebsiteUrl: () => Promise<string>
    sendMail: (mail: { to: string; subject: string; html: string; headers: Record<string, string> }) => Promise<boolean>
    /** Post to Slack. Never throws; false when the message could not be posted. */
    notify: (text: string) => Promise<boolean>
    adminUrl: (issueId: string) => string
    logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }
    /** Keys of Slack messages already sent; keeps repeating conditions to one message per day. */
    notified: Set<string>
    /** One-off messages (start, finish, failed start) Slack did not accept; retried each tick. */
    pendingAlerts: string[]
}

async function notifyOnce(deps: SendDeps, key: string, text: string): Promise<void> {
    const dayKey = `${berlinDayKey(deps.now())}:${key}`
    if (deps.notified.has(dayKey)) return
    // Remember the key only once Slack has the message, so a failed post is retried next tick.
    if (await deps.notify(text)) deps.notified.add(dayKey)
}

/** A one-off message: if Slack does not take it, keep it and retry on the next tick. */
async function notifyEvent(deps: SendDeps, text: string): Promise<void> {
    if (!(await deps.notify(text))) deps.pendingAlerts.push(text)
}

async function retryPendingAlerts(deps: SendDeps): Promise<void> {
    while (deps.pendingAlerts.length > 0) {
        if (!(await deps.notify(deps.pendingAlerts[0]!))) return
        deps.pendingAlerts.shift()
    }
}

/** A start (or its recovery) failed: back to draft so it does not retry every minute, and tell Slack. */
async function failStart(deps: SendDeps, issueId: string, error: any): Promise<void> {
    await deps.store.resetIssueToDraft(issueId)
    deps.logger.error(`newsletter-mass-send: could not start issue ${issueId}: ${error?.message ?? error}`)
    await notifyEvent(
        deps,
        `:x: *Newsletter*: Versand von Ausgabe ${issueId} konnte nicht starten (${error?.message ?? error}). Die Ausgabe steht wieder auf „draft“. ${deps.adminUrl(issueId)}`
    )
}

const label = (issue: { id: string; subject?: string | null }) =>
    issue.subject ? `„${issue.subject}“` : `Ausgabe ${issue.id}`

/**
 * Render the snapshot and queue one row per confirmed subscriber. Idempotent.
 *
 * The snapshot is saved LAST: it doubles as the "fan-out complete" marker. If the process
 * dies mid-fan-out, the issue is `sending` without a snapshot, so the next tick prepares
 * it again (existing rows are skipped) instead of sending to a partial list and finishing.
 */
async function prepareIssue(deps: SendDeps, issueId: string): Promise<{ queued: number; recipients: number }> {
    const { html, warnings, hiddenCount, renderedBlocks } = await deps.renderSnapshot(issueId)
    if (!hasUnsubscribePlaceholder(html)) {
        throw new Error('Der gerenderte Snapshot enthält keinen Abmeldelink-Platzhalter')
    }
    if (renderedBlocks === 0) {
        throw new Error(
            `kein Block hat Inhalt ergeben (${hiddenCount} unveröffentlichte Einträge ausgeblendet, ${warnings.length} Warnungen) – die Mail wäre leer`
        )
    }
    const recipients = await deps.store.confirmedSubscriberIds()
    const queued = await deps.store.queueSends(issueId, recipients)
    await deps.store.saveSnapshot(issueId, html)
    if (warnings.length > 0 || hiddenCount > 0) {
        deps.logger.warn(
            `newsletter-mass-send: issue ${issueId}: ${hiddenCount} hidden entries, warnings: ${warnings.join(' | ')}`
        )
    }
    return { queued, recipients: recipients.length }
}

/** Step 1: move due scheduled issues to `sending`, snapshot them and fan out the rows. */
export async function startDueIssues(deps: SendDeps): Promise<void> {
    const now = deps.now()
    for (const issue of await deps.store.findScheduledIssues()) {
        const scheduledAt = parseDirectusDateTime(issue.scheduled_at)
        if (!scheduledAt) {
            // The scheduling hook requires scheduled_at; a scheduled issue without one is left alone.
            await notifyOnce(
                deps,
                `no-schedule:${issue.id}`,
                `:warning: *Newsletter*: ${label(issue)} ist eingeplant, hat aber keinen gültigen Versandzeitpunkt und wird nicht versendet. ${deps.adminUrl(issue.id)}`
            )
            continue
        }
        if (scheduledAt.getTime() > now.getTime()) continue

        if (!(await deps.store.claimIssue(issue.id))) continue

        try {
            // An editor may have postponed the issue since we read it. Once claimed, scheduled_at
            // is frozen (newsletter-scheduling), so this re-read sees the final value.
            const currentAt = parseDirectusDateTime(await deps.store.getScheduledAt(issue.id))
            if (!currentAt || currentAt.getTime() > now.getTime()) {
                await deps.store.unclaimIssue(issue.id)
                continue
            }
            const { queued, recipients } = await prepareIssue(deps, issue.id)
            deps.logger.info(`newsletter-mass-send: started issue ${issue.id}, ${queued} rows queued`)
            await notifyEvent(
                deps,
                `:outbox_tray: *Newsletter*: Versand von Ausgabe ${issue.id} gestartet – ${recipients} bestätigte Empfänger. ${deps.adminUrl(issue.id)}`
            )
        } catch (error: any) {
            await failStart(deps, issue.id, error)
        }
    }
}

/** Steps 2–4: send queued rows within the daily limit, then finish issues without queued rows. */
export async function processSendingIssues(deps: SendDeps): Promise<void> {
    const issues = await deps.store.findSendingIssues()
    if (issues.length === 0) return

    const limit = await deps.store.getDailyLimit()
    if (limit === null) {
        await notifyOnce(
            deps,
            'limit-missing',
            ':warning: *Newsletter*: `newsletter_settings.daily_sending_limit` ist nicht gesetzt – der Versand pausiert, bis ein Tageslimit eingetragen ist.'
        )
        return
    }

    const now = deps.now()
    const sentToday = await deps.store.countSentSince(berlinDayStart(now))
    let budget = Math.min(Math.max(0, limit - sentToday), MAX_MAILS_PER_TICK)

    let websiteUrl: string | null = null

    for (const issue of issues) {
        let snapshot = issue.html_snapshot
        if (!hasUnsubscribePlaceholder(snapshot)) {
            // A crash between claim and the end of the fan-out: prepare again (idempotent).
            // Nothing of this run was sent yet, so a failure is handled like a failed start.
            try {
                // The crash may have come before startDueIssues' post-claim due check, so an
                // issue postponed between read and claim goes back to scheduled here.
                const scheduledAt = parseDirectusDateTime(await deps.store.getScheduledAt(issue.id))
                if (!scheduledAt || scheduledAt.getTime() > now.getTime()) {
                    await deps.store.unclaimIssue(issue.id)
                    continue
                }
                await prepareIssue(deps, issue.id)
                const refreshed = (await deps.store.findSendingIssues()).find((row) => row.id === issue.id)
                snapshot = refreshed?.html_snapshot ?? null
                if (!hasUnsubscribePlaceholder(snapshot)) {
                    throw new Error(`Ausgabe ${issue.id} hat keinen verwendbaren HTML-Snapshot`)
                }
            } catch (error: any) {
                await failStart(deps, issue.id, error)
                continue
            }
        }
        if (!issue.subject?.trim()) {
            throw new Error(`Ausgabe ${issue.id} hat keinen Betreff`)
        }

        if (budget > 0) {
            websiteUrl ??= await deps.getWebsiteUrl()
            budget = await sendBatch(deps, issue, snapshot, websiteUrl, budget)
        }

        await finishIfDone(deps, issue)
    }

    const remaining = limit - (await deps.store.countSentSince(berlinDayStart(now)))
    if (remaining <= 0) {
        await notifyOnce(
            deps,
            'limit-reached',
            `:hourglass: *Newsletter*: Tageslimit von ${limit} Mails erreicht – der Versand läuft morgen weiter.`
        )
    }
}

async function sendBatch(
    deps: SendDeps,
    issue: SendingIssue,
    snapshot: string,
    websiteUrl: string,
    budget: number
): Promise<number> {
    const rows = await deps.store.nextQueued(issue.id, budget)
    for (const row of rows) {
        if (budget <= 0) break

        // An editor may stop the send by changing the status.
        if ((await deps.store.getIssueStatus(issue.id)) !== 'sending') {
            deps.logger.info(`newsletter-mass-send: issue ${issue.id} is no longer sending, stopping`)
            break
        }

        const subscriber = await deps.store.getSubscriber(row.subscriber)
        if (!subscriber || subscriber.status !== 'confirmed') {
            await deps.store.markSend(
                row.id,
                'prevented',
                subscriber
                    ? `Abonnent ist nicht mehr bestätigt (${subscriber.status})`
                    : 'Abonnent existiert nicht mehr'
            )
            continue
        }

        if (!(await deps.store.claimSend(row.id, deps.now()))) continue
        budget--

        const unsubscribeUrl = buildUnsubscribeUrl(websiteUrl, subscriber.unsubscribe_token)
        const sent = await deps.sendMail({
            to: subscriber.email,
            subject: issue.subject as string,
            html: personalizeSnapshot(snapshot, unsubscribeUrl),
            // The send id lets the Brevo webhook note a bounce or complaint on this row.
            headers: {
                ...buildListUnsubscribeHeaders(unsubscribeUrl),
                ...buildNewsletterTrackingHeaders('send', row.id),
            },
        })
        if (!sent) {
            await deps.store.markSend(row.id, 'failed', 'Mailversand fehlgeschlagen (Details im Server-Log)')
            // Probably the mail transport; stop this tick instead of failing the whole batch.
            await notifyOnce(
                deps,
                `send-failed:${issue.id}`,
                `:warning: *Newsletter*: Mailversand für ${label(issue)} fehlgeschlagen – der Versand versucht es in der nächsten Minute mit den übrigen Empfängern weiter. Fehlgeschlagene Mails werden nicht wiederholt. ${deps.adminUrl(issue.id)}`
            )
            return 0
        }
    }
    return budget
}

async function finishIfDone(deps: SendDeps, issue: SendingIssue): Promise<void> {
    const counts = await deps.store.countByStatus(issue.id)
    if (counts.queued > 0) return
    if (!(await deps.store.finishIssue(issue.id, deps.now()))) return

    deps.logger.info(`newsletter-mass-send: finished issue ${issue.id}`)
    await notifyEvent(
        deps,
        `:white_check_mark: *Newsletter*: ${label(issue)} ist versendet – ${counts.sent} gesendet, ${counts.failed} fehlgeschlagen, ${counts.prevented} verhindert. ${deps.adminUrl(issue.id)}`
    )
}

/** One cron tick. Errors are reported to Slack (once per day per message) and not rethrown. */
export async function runNewsletterSendTick(deps: SendDeps): Promise<void> {
    try {
        await retryPendingAlerts(deps)
        await startDueIssues(deps)
        await processSendingIssues(deps)
    } catch (error: any) {
        const message = error?.message ?? String(error)
        deps.logger.error(`newsletter-mass-send: tick failed: ${message}`)
        await notifyOnce(deps, `error:${message}`, `:x: *Newsletter*: Fehler im Versand-Job: ${message}`)
    }
}
