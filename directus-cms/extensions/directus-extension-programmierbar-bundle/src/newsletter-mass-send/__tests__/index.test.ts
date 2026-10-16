import { describe, expect, jest, test } from '@jest/globals'
import { runNewsletterSendTick, type SendDeps } from '../../newsletter/send/run.ts'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerHook from '../index.ts'

jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))
jest.mock('../../shared/postSlackMessage.ts', () => ({ postSlackMessage: jest.fn() }))
jest.mock('../../newsletter/send/run.ts', () => ({ runNewsletterSendTick: jest.fn() }))

const runMock = jest.mocked(runNewsletterSendTick)
const slackMock = jest.mocked(postSlackMessage)

function register() {
    let cron: (() => Promise<void>) | undefined
    let expression = ''
    registerHook(
        {
            schedule: (expr: string, handler: () => Promise<void>) => {
                expression = expr
                cron = handler
            },
        } as any,
        {
            services: {},
            getSchema: async () => ({}),
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
            env: { PUBLIC_URL: 'https://admin.test/' },
            database: jest.fn(),
        } as any
    )
    return { cron: () => cron(), expression: () => expression }
}

describe('newsletter-mass-send hook', () => {
    test('runs every minute and skips a tick while the previous one is still running', async () => {
        const { cron, expression } = register()

        let release!: () => void
        runMock.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))

        const first = cron()
        await cron() // overlaps with the first tick
        expect(runMock).toHaveBeenCalledTimes(1)

        release()
        await first
        await cron()
        expect(runMock).toHaveBeenCalledTimes(2)
        expect(expression()).toBe('*/1 * * * *')
    })

    test('notify reports whether Slack accepted the message, so alerts are not lost', async () => {
        const { cron } = register()
        runMock.mockResolvedValueOnce()
        await cron()
        const deps = runMock.mock.calls.at(-1)![0] as SendDeps

        slackMock.mockResolvedValueOnce()
        expect(await deps.notify('ok')).toBe(true)
        slackMock.mockRejectedValueOnce(new Error('Slack: down'))
        expect(await deps.notify('weg')).toBe(false)
    })
})
