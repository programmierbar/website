import { describe, expect, test } from '@jest/globals'
import {
    anonymiseExpiredRegistrations,
    buildAnonymisationPatch,
    getMeetupEnd,
    getRetentionCutoff,
    isPastRetention,
    MEETUP_REGISTRATION_RETENTION_DAYS,
    needsAnonymisation,
    RetentionRunError,
    type RegistrationUpdate,
    type RetentionMeetup,
    type RetentionRegistration,
    type RetentionRepository,
} from '../util/retention.ts'

const NOW = new Date('2026-10-16T03:17:00.000Z')
const CUTOFF = new Date('2026-08-17T03:17:00.000Z') // NOW - 60 days

function registration(overrides: Partial<RetentionRegistration> = {}): RetentionRegistration {
    return {
        id: 'r1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        pronouns: 'sie/ihr',
        job_title: 'Engineer',
        company: 'Analytical Engines',
        heard_about_other: 'Von einer Freundin',
        cancelled_at: null,
        wants_meetup_updates: false,
        meetup_updates_consented_at: null,
        ...overrides,
    }
}

function anonymised(row: RetentionRegistration): RetentionRegistration {
    return { ...row, ...buildAnonymisationPatch(row, 'new-token') }
}

describe('selection', () => {
    test('the cutoff lies the retention period before now', () => {
        expect(MEETUP_REGISTRATION_RETENTION_DAYS).toBe(60)
        expect(getRetentionCutoff(NOW).toISOString()).toBe(CUTOFF.toISOString())
    })

    test('the meetup ends at end_on, else at start_on', () => {
        expect(getMeetupEnd({ id: 'm', start_on: '2026-08-01T17:00:00Z', end_on: '2026-08-01T21:00:00Z' })).toEqual(
            new Date('2026-08-01T21:00:00Z')
        )
        expect(getMeetupEnd({ id: 'm', start_on: '2026-08-01T17:00:00Z', end_on: null })).toEqual(
            new Date('2026-08-01T17:00:00Z')
        )
        expect(getMeetupEnd({ id: 'm', start_on: null, end_on: null })).toBeNull()
        expect(getMeetupEnd({ id: 'm', start_on: 'not a date' })).toBeNull()
    })

    test.each<[string, boolean, RetentionMeetup]>([
        ['ended more than 60 days ago', true, { id: 'm', start_on: '2026-08-10T17:00Z', end_on: '2026-08-10T21:00Z' }],
        ['has only a start_on more than 60 days ago', true, { id: 'm', start_on: '2026-08-17T03:16Z', end_on: null }],
        ['ends exactly at the cutoff', false, { id: 'm', start_on: '2026-08-17T01:00Z', end_on: '2026-08-17T03:17Z' }],
        [
            'started before but ended after the cutoff',
            false,
            { id: 'm', start_on: '2026-08-16T20:00Z', end_on: '2026-08-18T02:00Z' },
        ],
        ['took place recently', false, { id: 'm', start_on: '2026-10-01T17:00Z', end_on: '2026-10-01T21:00Z' }],
        ['has no date at all', false, { id: 'm', start_on: null, end_on: null }],
    ])('a meetup that %s is selected: %s', (_label, expected, meetup) => {
        expect(isPastRetention(meetup, CUTOFF)).toBe(expected)
    })
})

describe('anonymisation', () => {
    test('removes all personal data of a registration without consent', () => {
        const row = registration({ cancelled_at: '2026-08-01T10:00:00Z' })
        expect(buildAnonymisationPatch(row, 'new-token')).toEqual({
            cancel_token: 'new-token',
            first_name: '',
            last_name: '',
            email: '',
            pronouns: null,
            job_title: null,
            company: null,
            heard_about_other: null,
            cancelled_at: null,
            meetup_updates_consented_at: null,
        })
    })

    test('keeps only email and consent timestamp when the person wants meetup updates', () => {
        const row = registration({ wants_meetup_updates: true, meetup_updates_consented_at: '2026-08-01T10:00:00Z' })
        const patch = buildAnonymisationPatch(row, 'new-token')
        expect(patch).not.toHaveProperty('email')
        expect(patch).not.toHaveProperty('meetup_updates_consented_at')
        expect(patch).not.toHaveProperty('wants_meetup_updates')
        expect(patch).toMatchObject({ first_name: '', last_name: '', company: null, cancel_token: 'new-token' })
    })

    test('never touches the statistics fields', () => {
        const patch = buildAnonymisationPatch(registration(), 'new-token')
        for (const field of [
            'heard_about_from',
            'has_meetup_account',
            'is_internal',
            'status',
            'meetup',
            'date_created',
        ]) {
            expect(patch).not.toHaveProperty(field)
        }
    })

    test('an anonymised registration is not processed again', () => {
        expect(needsAnonymisation(registration())).toBe(true)
        expect(needsAnonymisation(anonymised(registration()))).toBe(false)

        const consenting = registration({
            wants_meetup_updates: true,
            meetup_updates_consented_at: '2026-08-01T10:00Z',
        })
        expect(needsAnonymisation(consenting)).toBe(true)
        expect(needsAnonymisation(anonymised(consenting))).toBe(false)
    })

    test('withdrawn consent clears the kept email on the next run', () => {
        const kept = anonymised(
            registration({ wants_meetup_updates: true, meetup_updates_consented_at: '2026-08-01T10:00Z' })
        )
        expect(needsAnonymisation({ ...kept, wants_meetup_updates: false })).toBe(true)
    })

    test('any single remaining personal field triggers anonymisation', () => {
        const clean = anonymised(registration())
        expect(needsAnonymisation({ ...clean, heard_about_other: 'x' })).toBe(true)
        expect(needsAnonymisation({ ...clean, last_name: 'x' })).toBe(true)
        expect(needsAnonymisation({ ...clean, cancelled_at: '2026-08-01T10:00Z' })).toBe(true)
    })
})

describe('anonymiseExpiredRegistrations', () => {
    type StoredRow = RetentionRegistration & { meetup: string }
    const stored = (id: string, meetup: string, overrides: Partial<RetentionRegistration> = {}): StoredRow => ({
        ...registration({ id, ...overrides }),
        meetup,
    })

    function fakeRepository(meetups: RetentionMeetup[], rows: StoredRow[]) {
        const store = new Map(rows.map((row) => [row.id, { ...row }]))
        const anonymiseCalls: RegistrationUpdate[][] = []
        const readCalls: Array<{ meetupIds: string[]; afterId: string | null }> = []
        let failOnCall: number | null = null

        const repository: RetentionRepository = {
            readMeetupCandidates: async () => meetups,
            readRegistrations: async (meetupIds, afterId, limit) => {
                readCalls.push({ meetupIds, afterId })
                return [...store.values()]
                    .filter((row) => meetupIds.includes(row.meetup) && (afterId === null || row.id > afterId))
                    .sort((a, b) => (a.id < b.id ? -1 : 1))
                    .slice(0, limit)
                    .map((row) => ({ ...row }))
            },
            anonymise: async (updates) => {
                if (failOnCall === anonymiseCalls.length) throw new Error('db down')
                anonymiseCalls.push(updates)
                for (const { id, patch } of updates) Object.assign(store.get(id)!, patch)
            },
        }
        return { repository, store, anonymiseCalls, readCalls, failOn: (call: number) => (failOnCall = call) }
    }

    const oldMeetup = { id: 'old', start_on: '2026-07-01T17:00Z', end_on: '2026-07-01T21:00Z' }
    const recentMeetup = { id: 'recent', start_on: '2026-10-01T17:00Z', end_on: null }

    let token = 0
    const options = (batchSize = 2) => ({ now: NOW, createToken: () => `token-${++token}`, batchSize })

    test('anonymises only registrations of meetups past the retention period, in batches', async () => {
        const fake = fakeRepository(
            [oldMeetup, recentMeetup],
            [
                stored('a', 'old'),
                stored('b', 'old', { wants_meetup_updates: true }),
                stored('c', 'old'),
                stored('d', 'recent'),
            ]
        )

        const result = await anonymiseExpiredRegistrations(fake.repository, options())

        expect(result).toEqual({ meetups: 1, scanned: 3, anonymised: 3, keptForConsent: 1 })
        expect(fake.readCalls.every((call) => call.meetupIds.join() === 'old')).toBe(true)
        expect(fake.anonymiseCalls.map((batch) => batch.map((u) => u.id))).toEqual([['a', 'b'], ['c']])
        expect(fake.store.get('a')).toMatchObject({ first_name: '', email: '' })
        expect(fake.store.get('b')).toMatchObject({ first_name: '', email: 'ada@example.com' })
        expect(fake.store.get('d')).toMatchObject({ first_name: 'Ada', email: 'ada@example.com' })
    })

    test('is idempotent: a second run changes nothing', async () => {
        const fake = fakeRepository([oldMeetup], [stored('a', 'old')])
        await anonymiseExpiredRegistrations(fake.repository, options())
        const second = await anonymiseExpiredRegistrations(fake.repository, options())

        expect(second).toEqual({ meetups: 1, scanned: 1, anonymised: 0, keptForConsent: 0 })
        expect(fake.anonymiseCalls).toHaveLength(1)
    })

    test('does not read registrations when no meetup is past the retention period', async () => {
        const fake = fakeRepository([recentMeetup], [])
        const result = await anonymiseExpiredRegistrations(fake.repository, options())
        expect(result.meetups).toBe(0)
        expect(fake.readCalls).toHaveLength(0)
    })

    test('reports what was done before a failure', async () => {
        const fake = fakeRepository(
            [oldMeetup],
            ['a', 'b', 'c'].map((id) => stored(id, 'old'))
        )
        fake.failOn(1)

        const run = anonymiseExpiredRegistrations(fake.repository, options())
        await expect(run).rejects.toBeInstanceOf(RetentionRunError)
        await run.catch((error: RetentionRunError) => {
            expect(error.message).toBe('db down')
            expect(error.result.anonymised).toBe(2)
        })
    })
})
