import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { safeAction } from '../safeHook.ts'

function createLogger() {
    return {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
    }
}

// Flush the microtask queue so the wrapper's internal Promise chain settles.
const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('safeAction', () => {
    let logger: ReturnType<typeof createLogger>

    beforeEach(() => {
        logger = createLogger()
    })

    test('runs the handler with the forwarded arguments', async () => {
        const handler = jest.fn()
        const wrapped = safeAction('test-hook', logger, handler)

        wrapped({ key: 1 }, { accountability: 'ctx' })
        await flush()

        expect(handler).toHaveBeenCalledWith({ key: 1 }, { accountability: 'ctx' })
    })

    test('returns void synchronously (never a promise that can reject)', () => {
        const wrapped = safeAction('test-hook', logger, () => {
            throw new Error('boom')
        })

        // Calling the wrapped handler must not throw and must not hand back a thenable.
        const result = wrapped({}, {}) as unknown
        expect(result).toBeUndefined()
    })

    test('swallows a synchronous throw and logs it', async () => {
        const wrapped = safeAction('test-hook', logger, () => {
            throw new Error('sync boom')
        })

        wrapped({}, {})
        await flush()

        expect(logger.error).toHaveBeenCalled()
        expect(String(logger.error.mock.calls[0]?.[0])).toContain('sync boom')
    })

    test('swallows a rejected promise returned by the handler and logs it', async () => {
        const wrapped = safeAction('test-hook', logger, async () => {
            throw new Error('async boom')
        })

        wrapped({}, {})
        await flush()

        expect(logger.error).toHaveBeenCalled()
        expect(String(logger.error.mock.calls[0]?.[0])).toContain('async boom')
    })

    test('does not log when the handler resolves successfully', async () => {
        const wrapped = safeAction('test-hook', logger, async () => 'ok')

        wrapped({}, {})
        await flush()

        expect(logger.error).not.toHaveBeenCalled()
    })

    test('survives a non-Error rejection value', async () => {
        const wrapped = safeAction('test-hook', logger, async () => {
            return Promise.reject('string failure')
        })

        wrapped({}, {})
        await flush()

        expect(logger.error).toHaveBeenCalled()
        expect(String(logger.error.mock.calls[0]?.[0])).toContain('string failure')
    })
})
