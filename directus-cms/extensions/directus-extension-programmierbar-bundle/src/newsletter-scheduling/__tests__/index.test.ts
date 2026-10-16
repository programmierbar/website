import { describe, expect, jest, test } from '@jest/globals'
import registerHook from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

// `@directus/errors` ships as ESM; mock the wrapper (as the other hook tests do).
jest.mock('../../shared/errors.ts', () => ({
    createHookErrorConstructor: (_code: string, message: string, status?: number) =>
        class extends Error {
            status = status
            constructor() {
                super(message)
            }
        },
}))

type Filter = (payload: any, meta: any, context: any) => any

function setup(stored: Record<string, any> | null) {
    const readOne = jest.fn(async () => {
        if (!stored) throw new Error('not found')
        return stored
    })
    const ItemsService = jest.fn().mockImplementation(() => ({ readOne }))
    const filters = new Map<string, Filter>()
    registerHook(
        { filter: (event: string, handler: Filter) => filters.set(event, handler) } as any,
        { services: { ItemsService }, logger: { info: jest.fn() }, getSchema: async () => ({}) } as any
    )
    return { filters, readOne }
}

const USER = { accountability: { user: 'editor-1', admin: false }, schema: {} }
const SYSTEM = { accountability: null, schema: {} }

describe('newsletter-scheduling hook', () => {
    test('rejects creating an incomplete scheduled issue with a 400', () => {
        const { filters } = setup(null)
        const create = filters.get('newsletter_issues.items.create')!

        expect(() => create({ status: 'scheduled', subject: 'X' }, {}, USER)).toThrow(
            'Zum Einplanen fehlt: Versandzeitpunkt (scheduled_at), mindestens ein Block.'
        )
        try {
            create({ status: 'scheduled' }, {}, USER)
        } catch (error: any) {
            expect(error.status).toBe(400)
        }
    })

    test('lets a complete scheduled issue be created', () => {
        const { filters } = setup(null)
        const payload = { status: 'scheduled', subject: 'X', scheduled_at: '2026-10-15T09:00:00Z', blocks: [{}] }
        expect(filters.get('newsletter_issues.items.create')!(payload, {}, USER)).toBe(payload)
    })

    test('validates an update against the stored issue', async () => {
        const { filters, readOne } = setup({ status: 'draft', subject: 'X', scheduled_at: null, blocks: [1] })
        const update = filters.get('newsletter_issues.items.update')!

        await expect(update({ status: 'scheduled' }, { keys: ['issue-1'] }, USER)).rejects.toThrow('Versandzeitpunkt')
        expect(readOne).toHaveBeenCalledWith('issue-1', { fields: ['status', 'subject', 'scheduled_at', 'blocks'] })
    })

    test('rejects an update when the stored issue cannot be read (fails closed)', async () => {
        const { filters, readOne } = setup({ status: 'sending', subject: 'X', scheduled_at: 'x', blocks: [1] })
        readOne.mockRejectedValueOnce(new Error('db weg'))
        const update = filters.get('newsletter_issues.items.update')!

        await expect(update({ preheader: 'neu' }, { keys: ['issue-1'] }, USER)).rejects.toThrow('db weg')
    })

    test('blocks content edits while sending', async () => {
        const { filters } = setup({ status: 'sending', subject: 'X', scheduled_at: 'x', blocks: [1] })
        const update = filters.get('newsletter_issues.items.update')!

        await expect(update({ preheader: 'neu' }, { keys: ['issue-1'] }, USER)).rejects.toThrow('preheader')
    })

    test('lets the send job write without restrictions', async () => {
        const { filters, readOne } = setup({ status: 'sending', subject: 'X', scheduled_at: 'x', blocks: [1] })
        const payload = { html_snapshot: '<p>x</p>' }

        await expect(
            filters.get('newsletter_issues.items.update')!(payload, { keys: ['issue-1'] }, SYSTEM)
        ).resolves.toBe(payload)
        expect(readOne).not.toHaveBeenCalled()
    })
})
