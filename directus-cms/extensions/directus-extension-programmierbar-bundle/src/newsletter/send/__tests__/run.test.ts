import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { MAX_MAILS_PER_TICK, runNewsletterSendTick, type SendDeps, type SendStatus, type SendStore } from '../run.ts'
import { UNSUBSCRIBE_URL_PLACEHOLDER } from '../snapshot.ts'

const NOW = new Date('2026-10-15T08:00:00Z') // 10:00 in Berlin
const SNAPSHOT = `<html><body><p>Inhalt</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Newsletter abbestellen</a></body></html>`

interface IssueRow {
    id: string
    status: string
    subject: string | null
    scheduled_at: string | null
    html_snapshot: string | null
    sent_at?: Date
}

interface SendRow {
    id: string
    issue: string
    subscriber: string
    status: SendStatus
    dedupe_key: string
    sent_at: Date | null
    error: string | null
}

interface SubscriberRow {
    id: string
    email: string
    status: string
    unsubscribe_token: string
}

function subscriber(n: number, status = 'confirmed'): SubscriberRow {
    return {
        id: `sub-${n}`,
        email: `leser${n}@example.de`,
        status,
        unsubscribe_token: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    }
}

class FakeStore implements SendStore {
    issues: IssueRow[] = []
    sends: SendRow[] = []
    subscribers: SubscriberRow[] = []
    limit: number | null = 200
    seq = 0
    /** Called before each status read, so a test can change the status mid-batch. */
    onStatusRead: (issueId: string, reads: number) => void = () => {}
    statusReads = 0

    async getDailyLimit() {
        return this.limit
    }
    async findScheduledIssues() {
        return this.issues
            .filter((i) => i.status === 'scheduled')
            .map((i) => ({ id: i.id, scheduled_at: i.scheduled_at }))
    }
    async claimIssue(issueId: string) {
        const issue = this.issues.find((i) => i.id === issueId && i.status === 'scheduled')
        if (!issue) return false
        issue.status = 'sending'
        issue.html_snapshot = null
        return true
    }
    async unclaimIssue(issueId: string) {
        const issue = this.issues.find((i) => i.id === issueId && i.status === 'sending')
        if (issue) issue.status = 'scheduled'
    }
    async getScheduledAt(issueId: string) {
        return this.issues.find((i) => i.id === issueId)?.scheduled_at ?? null
    }
    async resetIssueToDraft(issueId: string) {
        this.issues.find((i) => i.id === issueId)!.status = 'draft'
    }
    async saveSnapshot(issueId: string, html: string) {
        this.issues.find((i) => i.id === issueId)!.html_snapshot = html
    }
    async confirmedSubscriberIds() {
        return this.subscribers.filter((s) => s.status === 'confirmed').map((s) => s.id)
    }
    async queueSends(issueId: string, subscriberIds: string[]) {
        let created = 0
        for (const subscriberId of subscriberIds) {
            const dedupe = `${issueId}:${subscriberId}`
            if (this.sends.some((row) => row.dedupe_key === dedupe)) continue
            this.sends.push({
                id: `send-${++this.seq}`,
                issue: issueId,
                subscriber: subscriberId,
                status: 'queued',
                dedupe_key: dedupe,
                sent_at: null,
                error: null,
            })
            created++
        }
        return created
    }
    async findSendingIssues() {
        return this.issues
            .filter((i) => i.status === 'sending')
            .map((i) => ({ id: i.id, subject: i.subject, html_snapshot: i.html_snapshot }))
    }
    async getIssueStatus(issueId: string) {
        this.onStatusRead(issueId, ++this.statusReads)
        return this.issues.find((i) => i.id === issueId)?.status ?? null
    }
    async countSentSince(since: Date) {
        return this.sends.filter((row) => row.status === 'sent' && row.sent_at && row.sent_at >= since).length
    }
    async nextQueued(issueId: string, limit: number) {
        return this.sends
            .filter((row) => row.issue === issueId && row.status === 'queued')
            .slice(0, limit)
            .map((row) => ({ id: row.id, subscriber: row.subscriber }))
    }
    async getSubscriber(subscriberId: string) {
        return this.subscribers.find((s) => s.id === subscriberId) ?? null
    }
    async claimSend(sendId: string, sentAt: Date) {
        const row = this.sends.find((r) => r.id === sendId && r.status === 'queued')
        if (!row) return false
        row.status = 'sent'
        row.sent_at = sentAt
        return true
    }
    async markSend(sendId: string, status: 'failed' | 'prevented', error: string) {
        const row = this.sends.find((r) => r.id === sendId)!
        row.status = status
        row.error = error
        row.sent_at = null
    }
    async countByStatus(issueId: string) {
        const counts: Record<SendStatus, number> = { queued: 0, sent: 0, failed: 0, prevented: 0 }
        for (const row of this.sends.filter((r) => r.issue === issueId)) counts[row.status]++
        return counts
    }
    async finishIssue(issueId: string, sentAt: Date) {
        const issue = this.issues.find((i) => i.id === issueId && i.status === 'sending')
        if (!issue) return false
        issue.status = 'sent'
        issue.sent_at = sentAt
        return true
    }
}

function setup(
    options: {
        mailFails?: (to: string) => boolean
        renderFails?: boolean
        renderedBlocks?: (issueId: string) => number
        slackFails?: () => boolean
    } = {}
) {
    const store = new FakeStore()
    const mails: Array<{ to: string; subject: string; html: string; headers: Record<string, string> }> = []
    const slack: string[] = []
    const renders: string[] = []
    const deps: SendDeps = {
        store,
        now: () => NOW,
        notified: new Set(),
        pendingAlerts: [],
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        adminUrl: (id) => `https://admin.test/admin/content/newsletter_issues/${id}`,
        getWebsiteUrl: async () => 'https://www.programmier.bar',
        renderSnapshot: async (issueId) => {
            renders.push(issueId)
            if (options.renderFails) throw new Error('render kaputt')
            return {
                html: SNAPSHOT,
                warnings: [],
                hiddenCount: 0,
                renderedBlocks: options.renderedBlocks?.(issueId) ?? 1,
            }
        },
        sendMail: async (mail) => {
            if (options.mailFails?.(mail.to)) return false
            mails.push(mail)
            return true
        },
        notify: async (text) => {
            if (options.slackFails?.()) return false
            slack.push(text)
            return true
        },
    }
    const tick = () => runNewsletterSendTick(deps)
    return { store, mails, slack, renders, deps, tick }
}

function scheduledIssue(overrides: Partial<IssueRow> = {}): IssueRow {
    return {
        id: 'issue-1',
        status: 'scheduled',
        subject: 'Oktober-Ausgabe',
        scheduled_at: '2026-10-15T07:00:00Z',
        html_snapshot: null,
        ...overrides,
    }
}

describe('start', () => {
    test('a due issue is claimed, snapshotted and fanned out to confirmed subscribers only', async () => {
        const { store, tick, slack } = setup()
        store.subscribers = [subscriber(1), subscriber(2), subscriber(3, 'unsubscribed'), subscriber(4, 'pending')]
        store.issues = [scheduledIssue()]
        store.limit = 0 // keep the send step out of this test

        await tick()

        expect(store.issues[0]!.status).toBe('sending')
        expect(store.issues[0]!.html_snapshot).toBe(SNAPSHOT)
        expect(store.sends.map((row) => row.dedupe_key)).toEqual(['issue-1:sub-1', 'issue-1:sub-2'])
        expect(store.sends.every((row) => row.status === 'queued')).toBe(true)
        expect(slack[0]).toContain('gestartet – 2 bestätigte Empfänger')
    })

    test('an issue scheduled in the future is left alone', async () => {
        const { store, tick, renders } = setup()
        store.issues = [scheduledIssue({ scheduled_at: '2026-10-15T09:00:00Z' })]

        await tick()

        expect(store.issues[0]!.status).toBe('scheduled')
        expect(renders).toEqual([])
    })

    test('the start is idempotent: a lost claim neither renders nor queues', async () => {
        const { store, deps, renders, tick } = setup()
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue()]
        // Another process claimed it between our read and our claim.
        jest.spyOn(store, 'claimIssue').mockResolvedValueOnce(false)
        store.limit = 0

        await tick()

        expect(renders).toEqual([])
        expect(store.sends).toEqual([])
        expect(deps.logger.error).not.toHaveBeenCalled()
    })

    test('fan-out skips existing rows (dedupe), e.g. after a crash and a restart', async () => {
        const { store, tick } = setup()
        store.subscribers = [subscriber(1), subscriber(2)]
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: null })]
        await store.queueSends('issue-1', ['sub-1'])
        store.limit = 0

        await tick()

        // The missing snapshot is rendered again and only sub-2 is added.
        expect(store.sends.map((row) => row.dedupe_key)).toEqual(['issue-1:sub-1', 'issue-1:sub-2'])
        expect(store.issues[0]!.html_snapshot).toBe(SNAPSHOT)
    })

    test('a crash during fan-out leaves no snapshot, so the next tick completes the fan-out before finishing', async () => {
        const { store, tick, mails } = setup()
        store.subscribers = [subscriber(1), subscriber(2), subscriber(3)]
        store.issues = [scheduledIssue()]
        // The process dies after the first row: nothing after queueSends runs.
        const realQueue = store.queueSends.bind(store)
        jest.spyOn(store, 'queueSends').mockImplementationOnce(async (issueId) => {
            await realQueue(issueId, ['sub-1'])
            return new Promise<number>(() => {}) // never settles
        })
        void tick()
        await new Promise((resolve) => setImmediate(resolve))

        expect(store.issues[0]).toMatchObject({ status: 'sending', html_snapshot: null })
        expect(store.sends).toHaveLength(1)

        // After the restart.
        await tick()

        expect(store.sends.map((row) => row.dedupe_key)).toEqual(['issue-1:sub-1', 'issue-1:sub-2', 'issue-1:sub-3'])
        expect(mails.map((mail) => mail.to).sort()).toEqual([
            'leser1@example.de',
            'leser2@example.de',
            'leser3@example.de',
        ])
        expect(store.issues[0]!.status).toBe('sent')
    })

    test('an issue whose blocks all render empty is not started: back to draft, Slack, no rows', async () => {
        const { store, tick, slack, mails } = setup({ renderedBlocks: () => 0 })
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue()]

        await tick()

        expect(store.issues[0]).toMatchObject({ status: 'draft', html_snapshot: null })
        expect(store.sends).toEqual([])
        expect(mails).toEqual([])
        expect(slack.join('\n')).toContain('konnte nicht starten (kein Block hat Inhalt ergeben')
    })

    test('a rescheduled issue does not reuse the snapshot of its stopped run, even after a crash', async () => {
        const { store, tick, mails } = setup()
        const OLD = `<p>Alte Fassung</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">x</a>`
        store.subscribers = [subscriber(1), subscriber(2), subscriber(3)]
        // An earlier run sent to sub-1, was stopped, edited and scheduled again.
        store.issues = [scheduledIssue({ html_snapshot: OLD })]
        await store.queueSends('issue-1', ['sub-1'])
        store.sends[0]!.status = 'sent'
        const realQueue = store.queueSends.bind(store)
        jest.spyOn(store, 'queueSends').mockImplementationOnce(async (issueId) => {
            await realQueue(issueId, ['sub-2'])
            return new Promise<number>(() => {}) // the process dies here
        })
        void tick()
        await new Promise((resolve) => setImmediate(resolve))

        expect(store.issues[0]).toMatchObject({ status: 'sending', html_snapshot: null })

        await tick()

        expect(mails.map((mail) => mail.to).sort()).toEqual(['leser2@example.de', 'leser3@example.de'])
        expect(mails.every((mail) => mail.html.includes('Inhalt') && !mail.html.includes('Alte Fassung'))).toBe(true)
        expect(store.issues[0]!.status).toBe('sent')
    })

    test('a failed recovery puts that issue back to draft and the next issue is still sent', async () => {
        const { store, tick, mails, slack } = setup({ renderedBlocks: (id) => (id === 'issue-a' ? 0 : 1) })
        store.subscribers = [subscriber(1)]
        store.issues = [
            scheduledIssue({ id: 'issue-a', status: 'sending', html_snapshot: null }),
            scheduledIssue({ id: 'issue-b', status: 'sending', html_snapshot: null }),
        ]

        await tick()

        expect(store.issues.map((issue) => issue.status)).toEqual(['draft', 'sent'])
        expect(store.sends.filter((row) => row.issue === 'issue-a')).toEqual([])
        expect(mails).toHaveLength(1)
        expect(slack.join('\n')).toContain(
            'Versand von Ausgabe issue-a konnte nicht starten (kein Block hat Inhalt ergeben'
        )
    })

    test('an issue postponed after it was read is put back to scheduled, not sent', async () => {
        const { store, tick, renders } = setup()
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue()]
        // The editor moves scheduled_at into the future between our read and our claim.
        const realClaim = store.claimIssue.bind(store)
        jest.spyOn(store, 'claimIssue').mockImplementationOnce(async (issueId) => {
            store.issues[0]!.scheduled_at = '2026-10-16T08:00:00Z'
            return realClaim(issueId)
        })

        await tick()

        expect(store.issues[0]!.status).toBe('scheduled')
        expect(renders).toEqual([])
        expect(store.sends).toEqual([])
    })

    test('a failing render puts the issue back to draft and reports it', async () => {
        const { store, tick, slack } = setup({ renderFails: true })
        store.issues = [scheduledIssue()]

        await tick()

        expect(store.issues[0]!.status).toBe('draft')
        expect(store.sends).toEqual([])
        expect(slack.join('\n')).toContain('konnte nicht starten (render kaputt)')
    })

    test('a scheduled issue without a valid scheduled_at is reported once and not sent', async () => {
        const { store, tick, slack } = setup()
        store.issues = [scheduledIssue({ scheduled_at: null })]

        await tick()
        await tick()

        expect(store.issues[0]!.status).toBe('scheduled')
        expect(slack.filter((text) => text.includes('keinen gültigen Versandzeitpunkt'))).toHaveLength(1)
    })
})

describe('sending', () => {
    test('sends the snapshot with the personal unsubscribe link and the List-Unsubscribe headers', async () => {
        const { store, tick, mails } = setup()
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue()]

        await tick()

        expect(mails).toHaveLength(1)
        const url = `https://www.programmier.bar/newsletter/unsubscribe?token=${subscriber(1).unsubscribe_token}`
        expect(mails[0]).toMatchObject({ to: 'leser1@example.de', subject: 'Oktober-Ausgabe' })
        expect(mails[0]!.html).toContain(`href="${url}"`)
        expect(mails[0]!.html).not.toContain(UNSUBSCRIBE_URL_PLACEHOLDER)
        expect(mails[0]!.headers).toEqual({
            'List-Unsubscribe': `<${url}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        })
        expect(store.sends[0]).toMatchObject({ status: 'sent', sent_at: NOW })
    })

    test('a subscriber who is no longer confirmed is marked prevented, not mailed', async () => {
        const { store, tick, mails } = setup()
        store.subscribers = [subscriber(1), subscriber(2)]
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: SNAPSHOT })]
        await store.queueSends('issue-1', ['sub-1', 'sub-2'])
        store.subscribers[0]!.status = 'unsubscribed'

        await tick()

        expect(mails.map((mail) => mail.to)).toEqual(['leser2@example.de'])
        expect(store.sends[0]).toMatchObject({ status: 'prevented', error: expect.stringContaining('unsubscribed') })
    })

    test('stops processing the issue’s rows as soon as its status is no longer sending', async () => {
        const { store, tick, mails } = setup()
        store.subscribers = [subscriber(1), subscriber(2), subscriber(3)]
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: SNAPSHOT })]
        await store.queueSends('issue-1', ['sub-1', 'sub-2', 'sub-3'])
        // An editor sets the issue back to draft after the first mail.
        store.onStatusRead = (_id, reads) => {
            if (reads === 2) store.issues[0]!.status = 'draft'
        }

        await tick()

        expect(mails).toHaveLength(1)
        expect(store.sends.filter((row) => row.status === 'queued')).toHaveLength(2)
        expect(store.issues[0]!.status).toBe('draft')
    })

    test('a failed mail marks the row failed and stops the tick', async () => {
        const { store, tick, mails, slack } = setup({ mailFails: (to) => to === 'leser1@example.de' })
        store.subscribers = [subscriber(1), subscriber(2)]
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: SNAPSHOT })]
        await store.queueSends('issue-1', ['sub-1', 'sub-2'])

        await tick()

        expect(store.sends[0]).toMatchObject({ status: 'failed', sent_at: null })
        expect(store.sends[1]!.status).toBe('queued')
        expect(mails).toHaveLength(0)
        expect(slack.join('\n')).toContain('Mailversand für „Oktober-Ausgabe“ fehlgeschlagen')

        await tick()
        expect(mails.map((mail) => mail.to)).toEqual(['leser2@example.de'])
    })
})

describe('daily limit', () => {
    test('a missing limit pauses the send with one Slack message, no fallback number', async () => {
        const { store, tick, mails, slack } = setup()
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue()]
        store.limit = null

        await tick()
        await tick()

        expect(mails).toHaveLength(0)
        expect(store.sends[0]!.status).toBe('queued')
        expect(slack.filter((text) => text.includes('daily_sending_limit'))).toHaveLength(1)
    })

    test('sends only the remainder of today’s limit (Berlin day) and reports the pause once', async () => {
        const { store, tick, mails, slack } = setup()
        store.subscribers = [1, 2, 3, 4].map((n) => subscriber(n))
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: SNAPSHOT })]
        // Two mails of another issue went out today (after Berlin midnight = 22:00 UTC), one yesterday.
        store.sends.push(
            {
                id: 'old-1',
                issue: 'issue-0',
                subscriber: 'x',
                status: 'sent',
                dedupe_key: 'a',
                sent_at: new Date('2026-10-14T22:30:00Z'),
                error: null,
            },
            {
                id: 'old-2',
                issue: 'issue-0',
                subscriber: 'y',
                status: 'sent',
                dedupe_key: 'b',
                sent_at: new Date('2026-10-15T06:00:00Z'),
                error: null,
            },
            {
                id: 'old-3',
                issue: 'issue-0',
                subscriber: 'z',
                status: 'sent',
                dedupe_key: 'c',
                sent_at: new Date('2026-10-14T21:30:00Z'),
                error: null,
            }
        )
        await store.queueSends('issue-1', ['sub-1', 'sub-2', 'sub-3', 'sub-4'])
        store.limit = 4

        await tick()
        await tick()

        expect(mails).toHaveLength(2)
        expect(store.sends.filter((row) => row.issue === 'issue-1' && row.status === 'queued')).toHaveLength(2)
        expect(store.issues[0]!.status).toBe('sending')
        expect(slack.filter((text) => text.includes('Tageslimit von 4 Mails erreicht'))).toHaveLength(1)
    })

    test(`never sends more than ${MAX_MAILS_PER_TICK} mails per tick`, async () => {
        const { store, tick, mails } = setup()
        store.subscribers = Array.from({ length: MAX_MAILS_PER_TICK + 5 }, (_, i) => subscriber(i + 1))
        store.issues = [scheduledIssue()]
        store.limit = 500

        await tick()

        expect(mails).toHaveLength(MAX_MAILS_PER_TICK)
    })
})

describe('finish', () => {
    test('marks the issue sent when no rows are queued and posts a summary', async () => {
        const { store, tick, slack } = setup()
        store.subscribers = [subscriber(1), subscriber(2), subscriber(3)]
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: SNAPSHOT })]
        await store.queueSends('issue-1', ['sub-1', 'sub-2', 'sub-3'])
        store.subscribers[2]!.status = 'bounced'

        await tick()

        expect(store.issues[0]).toMatchObject({ status: 'sent', sent_at: NOW })
        expect(slack.at(-1)).toContain('„Oktober-Ausgabe“ ist versendet – 2 gesendet, 0 fehlgeschlagen, 1 verhindert')
    })

    test('an issue with no recipients is finished with a zero summary', async () => {
        const { store, tick, slack } = setup()
        store.issues = [scheduledIssue()]

        await tick()

        expect(store.issues[0]!.status).toBe('sent')
        expect(slack.at(-1)).toContain('0 gesendet')
    })
})

describe('errors', () => {
    let setupResult: ReturnType<typeof setup>
    beforeEach(() => {
        setupResult = setup()
    })

    test('an unexpected error is reported to Slack once and does not throw', async () => {
        const { store, tick, slack } = setupResult
        jest.spyOn(store, 'findScheduledIssues').mockRejectedValue(new Error('db weg'))

        await expect(tick()).resolves.toBeUndefined()
        await tick()

        expect(slack.filter((text) => text.includes('db weg'))).toHaveLength(1)
    })

    test('a Slack alert that could not be posted is retried on the next tick', async () => {
        let slackDown = true
        const { store, tick, slack } = setup({ slackFails: () => slackDown })
        jest.spyOn(store, 'findScheduledIssues').mockRejectedValue(new Error('db weg'))

        await tick()
        expect(slack).toEqual([])

        slackDown = false
        await tick()
        await tick()

        expect(slack.filter((text) => text.includes('db weg'))).toHaveLength(1)
    })

    test('a start announcement Slack did not accept is posted on the next tick', async () => {
        let slackDown = true
        const { store, tick, slack } = setup({ slackFails: () => slackDown })
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue()]
        store.limit = 0

        await tick()
        expect(slack).toEqual([])

        slackDown = false
        await tick()
        await tick()

        expect(slack.filter((text) => text.includes('gestartet'))).toHaveLength(1)
    })

    test('a subscriber read error leaves the row queued instead of marking it prevented', async () => {
        const { store, tick, mails } = setup()
        store.subscribers = [subscriber(1)]
        store.issues = [scheduledIssue({ status: 'sending', html_snapshot: SNAPSHOT })]
        await store.queueSends('issue-1', ['sub-1'])
        jest.spyOn(store, 'getSubscriber').mockRejectedValueOnce(new Error('SQLITE_BUSY'))

        await tick()
        expect(store.sends[0]!.status).toBe('queued')
        expect(store.issues[0]!.status).toBe('sending')

        await tick()
        expect(mails.map((mail) => mail.to)).toEqual(['leser1@example.de'])
    })
})
