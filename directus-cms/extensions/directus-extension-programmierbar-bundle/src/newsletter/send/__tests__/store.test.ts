import { describe, expect, jest, test } from '@jest/globals'
import { createDirectusSendStore } from '../store.ts'

// A tiny knex stand-in: `database(table).where(match).update(values)` updates matching rows
// and resolves to the number of affected rows, like a conditional UPDATE.
function fakeDatabase(tables: Record<string, Array<Record<string, any>>>) {
    const updates: Array<{ table: string; where: any; values: any }> = []
    const database = (table: string) => ({
        where: (match: Record<string, any>) => ({
            update: async (values: Record<string, any>) => {
                updates.push({ table, where: match, values })
                const rows = (tables[table] ?? []).filter((row) =>
                    Object.entries(match).every(([key, value]) => row[key] === value)
                )
                rows.forEach((row) => Object.assign(row, values))
                return rows.length
            },
        }),
    })
    return { database, updates }
}

function services(
    created: any[],
    options: { existing?: any[]; duplicateFor?: string; subscribers?: any[]; readError?: Error } = {}
) {
    class ItemsService {
        constructor(
            public collection: string,
            public opts: any
        ) {}
        async readByQuery(query: any) {
            if (options.readError) throw options.readError
            if (this.collection === 'newsletter_subscribers') {
                return (options.subscribers ?? []).filter((row) => row.id === query.filter.id._eq)
            }
            return options.existing ?? []
        }
        async createOne(data: any) {
            if (data.subscriber === options.duplicateFor) {
                throw Object.assign(new Error('not unique'), { code: 'RECORD_NOT_UNIQUE' })
            }
            created.push({ data, accountability: this.opts.accountability })
            return 'new'
        }
    }
    return { ItemsService }
}

describe('claims are conditional updates', () => {
    test('claimIssue only moves a scheduled issue, once', async () => {
        const tables = { newsletter_issues: [{ id: 'i1', status: 'scheduled' }] }
        const { database, updates } = fakeDatabase(tables)
        const store = createDirectusSendStore({ services: services([]), getSchema: async () => ({}), database })

        expect(await store.claimIssue('i1')).toBe(true)
        expect(await store.claimIssue('i1')).toBe(false)
        expect(updates[0]).toEqual({
            table: 'newsletter_issues',
            where: { id: 'i1', status: 'scheduled' },
            values: { status: 'sending', html_snapshot: null },
        })
    })

    test('claimSend only moves a queued row and stamps sent_at', async () => {
        const tables = { newsletter_sends: [{ id: 's1', status: 'queued' }] }
        const { database } = fakeDatabase(tables)
        const store = createDirectusSendStore({ services: services([]), getSchema: async () => ({}), database })
        const now = new Date('2026-10-15T08:00:00Z')

        expect(await store.claimSend('s1', now)).toBe(true)
        expect(await store.claimSend('s1', now)).toBe(false)
        expect(tables.newsletter_sends[0]).toEqual({ id: 's1', status: 'sent', sent_at: '2026-10-15T08:00:00.000Z' })
    })

    test('unclaimIssue only moves a sending issue back to scheduled', async () => {
        const tables = { newsletter_issues: [{ id: 'i1', status: 'sending' }] }
        const { database, updates } = fakeDatabase(tables)
        const store = createDirectusSendStore({ services: services([]), getSchema: async () => ({}), database })

        await store.unclaimIssue('i1')

        expect(tables.newsletter_issues[0]!.status).toBe('scheduled')
        expect(updates[0]!.where).toEqual({ id: 'i1', status: 'sending' })
    })

    test('finishIssue only moves a sending issue', async () => {
        const tables = { newsletter_issues: [{ id: 'i1', status: 'draft' }] }
        const { database } = fakeDatabase(tables)
        const store = createDirectusSendStore({ services: services([]), getSchema: async () => ({}), database })

        expect(await store.finishIssue('i1', new Date())).toBe(false)
        expect(tables.newsletter_issues[0]!.status).toBe('draft')
    })
})

describe('queueSends', () => {
    test('creates rows with dedupe_key as system writes and skips existing and duplicate ones', async () => {
        const created: any[] = []
        const store = createDirectusSendStore({
            services: services(created, { existing: [{ subscriber: 'sub-1' }], duplicateFor: 'sub-3' }),
            getSchema: async () => ({}),
            database: jest.fn(),
        })

        const count = await store.queueSends('i1', ['sub-1', 'sub-2', 'sub-3'])

        expect(count).toBe(1)
        expect(created).toEqual([
            {
                data: { issue: 'i1', subscriber: 'sub-2', status: 'queued', dedupe_key: 'i1:sub-2' },
                accountability: null,
            },
        ])
    })
})

describe('getSubscriber', () => {
    const fields = { email: 'a@example.de', status: 'confirmed', unsubscribe_token: 't' }

    test('returns the subscriber, or null when it no longer exists', async () => {
        const store = createDirectusSendStore({
            services: services([], { subscribers: [{ id: 'sub-1', ...fields }] }),
            getSchema: async () => ({}),
            database: jest.fn(),
        })

        expect(await store.getSubscriber('sub-1')).toMatchObject(fields)
        expect(await store.getSubscriber('sub-2')).toBeNull()
    })

    test('propagates read errors instead of reporting the subscriber as deleted', async () => {
        const store = createDirectusSendStore({
            services: services([], { readError: new Error('SQLITE_BUSY') }),
            getSchema: async () => ({}),
            database: jest.fn(),
        })

        await expect(store.getSubscriber('sub-1')).rejects.toThrow('SQLITE_BUSY')
    })
})
