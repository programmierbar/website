import { decide, type BrevoEvent, type SubscriberTransition } from './events.ts'

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
}

export interface ProcessResult {
    received: number
    transitioned: number
    notedSends: number
}

/**
 * Applies a batch of Brevo events. Idempotent, so Brevo may deliver an event twice: the
 * subscriber update only moves non-final states and the send note only fills an empty
 * `error`. An unknown address is a no-op, not an error — Brevo reports on every mail of
 * the account, most of whose recipients are no subscribers. Store errors propagate, so
 * the request fails and Brevo can deliver again.
 */
export async function processBrevoEvents(events: BrevoEvent[], deps: WebhookDeps): Promise<ProcessResult> {
    const result: ProcessResult = { received: events.length, transitioned: 0, notedSends: 0 }

    for (const raw of events) {
        const decision = decide(raw)

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
