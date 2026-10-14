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
    /** scheduled → sending, only if still scheduled. True if this call made the change. */
    claimIssue(issueId: string): Promise<boolean>
    /** Back to draft after a failed start, so it does not retry every minute. */
    resetIssueToDraft(issueId: string): Promise<void>
    saveSnapshot(issueId: string, html: string): Promise<void>
    confirmedSubscriberIds(): Promise<string[]>
    /** One queued row per subscriber; existing ones are skipped (unique `dedupe_key`). Returns the number created. */
    queueSends(issueId: string, subscriberIds: string[]): Promise<number>
    findSendingIssues(): Promise<SendingIssue[]>
    getIssueStatus(issueId: string): Promise<string | null>
    countSentSince(since: Date): Promise<number>
    nextQueued(issueId: string, limit: number): Promise<QueuedSend[]>
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
    renderSnapshot: (issueId: string) => Promise<{ html: string; warnings: string[]; hiddenCount: number }>
    getWebsiteUrl: () => Promise<string>
    sendMail: (mail: { to: string; subject: string; html: string; headers: Record<string, string> }) => Promise<boolean>
    notify: (text: string) => Promise<void>
    adminUrl: (issueId: string) => string
    logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }
    /** Keys of Slack messages already sent; keeps repeating conditions to one message per day. */
    notified: Set<string>
}

async function notifyOnce(deps: SendDeps, key: string, text: string): Promise<void> {
    const dayKey = `${berlinDayKey(deps.now())}:${key}`
    if (deps.notified.has(dayKey)) return
    deps.notified.add(dayKey)
    await deps.notify(text)
}

const label = (issue: { id: string; subject?: string | null }) =>
    issue.subject ? `„${issue.subject}“` : `Ausgabe ${issue.id}`

/** Render the snapshot and queue one row per confirmed subscriber. Idempotent. */
async function prepareIssue(deps: SendDeps, issueId: string): Promise<{ queued: number; recipients: number }> {
    const { html, warnings, hiddenCount } = await deps.renderSnapshot(issueId)
    if (!hasUnsubscribePlaceholder(html)) {
        throw new Error('Der gerenderte Snapshot enthält keinen Abmeldelink-Platzhalter')
    }
    await deps.store.saveSnapshot(issueId, html)
    const recipients = await deps.store.confirmedSubscriberIds()
    const queued = await deps.store.queueSends(issueId, recipients)
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
            const { queued, recipients } = await prepareIssue(deps, issue.id)
            deps.logger.info(`newsletter-mass-send: started issue ${issue.id}, ${queued} rows queued`)
            await deps.notify(
                `:outbox_tray: *Newsletter*: Versand von Ausgabe ${issue.id} gestartet – ${recipients} bestätigte Empfänger. ${deps.adminUrl(issue.id)}`
            )
        } catch (error: any) {
            await deps.store.resetIssueToDraft(issue.id)
            deps.logger.error(`newsletter-mass-send: could not start issue ${issue.id}: ${error?.message ?? error}`)
            await deps.notify(
                `:x: *Newsletter*: Versand von Ausgabe ${issue.id} konnte nicht starten (${error?.message ?? error}). Die Ausgabe steht wieder auf „draft“. ${deps.adminUrl(issue.id)}`
            )
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
            // A crash between claim and snapshot: prepare again (idempotent).
            await prepareIssue(deps, issue.id)
            const refreshed = (await deps.store.findSendingIssues()).find((row) => row.id === issue.id)
            snapshot = refreshed?.html_snapshot ?? null
            if (!hasUnsubscribePlaceholder(snapshot)) {
                throw new Error(`Ausgabe ${issue.id} hat keinen verwendbaren HTML-Snapshot`)
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
            headers: buildListUnsubscribeHeaders(unsubscribeUrl),
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
    await deps.notify(
        `:white_check_mark: *Newsletter*: ${label(issue)} ist versendet – ${counts.sent} gesendet, ${counts.failed} fehlgeschlagen, ${counts.prevented} verhindert. ${deps.adminUrl(issue.id)}`
    )
}

/** One cron tick. Errors are reported to Slack (once per day per message) and not rethrown. */
export async function runNewsletterSendTick(deps: SendDeps): Promise<void> {
    try {
        await startDueIssues(deps)
        await processSendingIssues(deps)
    } catch (error: any) {
        const message = error?.message ?? String(error)
        deps.logger.error(`newsletter-mass-send: tick failed: ${message}`)
        await notifyOnce(deps, `error:${message}`, `:x: *Newsletter*: Fehler im Versand-Job: ${message}`)
    }
}
