import { describe, expect, test } from '@jest/globals'
import { createKeyedSerializer } from '../serializeByKey.ts'

function deferred() {
    let resolve!: () => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('createKeyedSerializer', () => {
    test('runs tasks for the same key one after another', async () => {
        const serialize = createKeyedSerializer()
        const first = deferred()
        const events: string[] = []

        const a = serialize(1, async () => {
            events.push('a:start')
            await first.promise
            events.push('a:end')
        })
        const b = serialize(1, async () => {
            events.push('b:start')
        })

        await flush()
        expect(events).toEqual(['a:start'])

        first.resolve()
        await Promise.all([a, b])
        expect(events).toEqual(['a:start', 'a:end', 'b:start'])
    })

    test('runs tasks for different keys concurrently', async () => {
        const serialize = createKeyedSerializer()
        const first = deferred()
        const events: string[] = []

        const a = serialize(1, async () => {
            events.push('a:start')
            await first.promise
        })
        const b = serialize(2, async () => {
            events.push('b:start')
        })

        await b
        expect(events).toEqual(['a:start', 'b:start'])

        first.resolve()
        await a
    })

    test('continues the chain after a rejection and passes it to the caller', async () => {
        const serialize = createKeyedSerializer()

        const a = serialize(1, async () => {
            throw new Error('boom')
        })
        const b = serialize(1, async () => 'ok')

        await expect(a).rejects.toThrow('boom')
        await expect(b).resolves.toBe('ok')
    })

    test('runs a task without a key immediately', async () => {
        const serialize = createKeyedSerializer()
        const first = deferred()
        let ran = false

        const a = serialize(undefined, () => first.promise)
        const b = serialize(undefined, () => {
            ran = true
        })

        await b
        expect(ran).toBe(true)

        first.resolve()
        await a
    })
})
