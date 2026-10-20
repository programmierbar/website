import { decide, type BrevoEvent, type Decision, type SubscriberTransition } from './events.ts'

export interface WebhookStore {
    /**
     * Moves the subscriber with this address from `pending` / `confirmed` to `to`, in one
     * conditional update. Unsubscribed, bounced and complained subscribers are never
     * touched, so repeats and late events are no-ops. True if a row changed.
     */
    transitionSubscriber(email: string, to: SubscriberTransition, now: Date): Promise<boolean>
    /** Writes `note` into `error` of a `sent` row that has no error yet. True if a row changed. */
    noteSend(sendId: string, note: string, now: Date): Promise<boolean>
}

export interface WebhookDeps {
    store: WebhookStore
    now: () => Date
    logger: { info: (msg: string) => void; warn: (msg: string) => void }
    /** Post to Slack. Never throws. */
    notify: (text: string) => Promise<unknown>
    /**
     * Post to Slack at most once per `key` and day; a key whose message Slack did not take is
     * released again. Never throws.
     */
    notifyOnce: (key: string, text: string) => Promise<unknown>
}

/** Slack reads `&`, `<` and `>` as markup. */
function escapeSlack(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Slack warning for a non-newsletter mail that did not arrive. */
export function mailFailureMessage(decision: Decision): string {
    const reason = decision.reason ? ` (${escapeSlack(decision.reason)})` : ''
    const subject = decision.subject ? `„${escapeSlack(decision.subject)}“` : '(ohne Betreff)'
    return `:warning: *E-Mail*: Brevo hat eine Mail an ${escapeSlack(decision.email || '(keine Adresse)')} nicht zugestellt – \`${decision.event}\`${reason}. Betreff: ${subject}. Falls wichtig (z. B. Bestellbestätigung oder Rechnung), bitte auf anderem Weg nachreichen.`
}

/**
 * Brevo may deliver the same event again (e.g. after a 500), so the warning is keyed by the
 * mail: its message id, or address and subject if Brevo sent none.
 */
function mailFailureKey(decision: Decision): string {
    const mail = decision.messageId ?? `${decision.email}|${decision.subject ?? ''}`
    return `mail-failure:${decision.event}:${mail}`
}

export interface ProcessResult {
    received: number
    transitioned: number
    notedSends: number
}

/**
 * Applies a batch of Brevo events. Idempotent, so Brevo may deliver an event twice: the
 * subscriber update only moves non-final states, the send note only fills an empty
 * `error`, and the warning about an undelivered non-newsletter mail goes out once per mail. An unknown address is a no-op, not an error — Brevo reports on every mail of
 * the account, most of whose recipients are no subscribers. Store errors propagate, so
 * the request fails and Brevo can deliver again.
 */
export async function processBrevoEvents(events: BrevoEvent[], deps: WebhookDeps): Promise<ProcessResult> {
    const result: ProcessResult = { received: events.length, transitioned: 0, notedSends: 0 }

    for (const raw of events) {
        const decision = decide(raw)

        if (decision.mailFailure) {
            // Before the database writes, so a failing write does not hold the warning back.
            deps.logger.warn(
                `brevo-webhook: ${decision.event} for ${decision.email || '(no address)'} on a non-newsletter mail (subject: ${decision.subject ?? '-'}, reason: ${decision.reason ?? '-'})`
            )
            await deps.notifyOnce(mailFailureKey(decision), mailFailureMessage(decision))
        }

        if (decision.sendId && (await deps.store.noteSend(decision.sendId, decision.note, deps.now()))) {
            result.notedSends++
        }

        if (!decision.transition) {
            if (decision.event === 'spam' || decision.event === 'unsubscribed') {
                deps.logger.info(
                    `brevo-webhook: ${decision.event} for ${decision.email || '(no address)'} on a non-newsletter mail, subscriber unchanged`
                )
            }
            continue
        }
        if (!decision.email) {
            deps.logger.warn(`brevo-webhook: ${decision.event} event without an address, ignored`)
            continue
        }

        const changed = await deps.store.transitionSubscriber(decision.email, decision.transition, deps.now())
        if (!changed) {
            // Not a subscriber, or already unsubscribed/bounced/complained.
            deps.logger.info(
                `brevo-webhook: ${decision.event} for ${decision.email}: no pending/confirmed subscriber, nothing changed`
            )
            continue
        }

        result.transitioned++
        deps.logger.info(`brevo-webhook: ${decision.event} for ${decision.email}: subscriber → ${decision.transition}`)
        if (decision.transition === 'complained') {
            // Complaints hurt the sender reputation of every mail we send, so a human should know.
            await deps.notify(
                `:rotating_light: *Newsletter*: Spam-Beschwerde von ${decision.email} – der Abonnent steht jetzt auf „complained“ und bekommt keinen Newsletter mehr.`
            )
        }
    }

    return result
}
