import { describe, expect, jest, test } from '@jest/globals'
import registerHook from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

type Filter = (payload: any, meta: any, context: any) => any

function setup(env: Record<string, unknown>) {
    const filters = new Map<string, Filter>()
    registerHook(
        { filter: (event: string, handler: Filter) => filters.set(event, handler) } as any,
        { env, logger: { info: jest.fn() } } as any
    )
    return filters
}

describe('mail-reply-to hook', () => {
    test('sets Reply-To from EMAIL_REPLY_TO', () => {
        const filter = setup({ EMAIL_REPLY_TO: ' replies@example.com ' }).get('email.send')!
        const message = { to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>' }

        expect(filter(message, {}, {})).toEqual({ ...message, replyTo: 'replies@example.com' })
        // The original message is not mutated.
        expect(message).not.toHaveProperty('replyTo')
    })

    test('keeps a Reply-To the caller set', () => {
        const filter = setup({ EMAIL_REPLY_TO: 'replies@example.com' }).get('email.send')!
        const message = { to: 'a@example.com', subject: 'Hi', replyTo: 'speaker@example.com' }

        expect(filter(message, {}, {})).toBe(message)
    })

    test.each([[{}], [{ EMAIL_REPLY_TO: '' }], [{ EMAIL_REPLY_TO: '   ' }]])(
        'registers no filter when EMAIL_REPLY_TO is unset or empty (%j)',
        (env) => {
            expect(setup(env).has('email.send')).toBe(false)
        }
    )
})
