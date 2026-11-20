import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { postSlackMessage } from '../../shared/postSlackMessage.ts'
import registerHook, { RETENTION_SCHEDULE } from '../index.ts'
import { createRetentionRepository } from '../util/repository.ts'
import type { RetentionRepository } from '../util/retention.ts'

jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

jest.mock('../../shared/postSlackMessage.ts', () => ({
    postSlackMessage: jest.fn(),
}))

jest.mock('../util/repository.ts', () => ({
    createRetentionRepository: jest.fn(),
}))

const postSlackMessageMock = jest.mocked(postSlackMessage)
const createRepositoryMock = jest.mocked(createRetentionRepository)

function setup(repository: Partial<RetentionRepository>, database: unknown = {}) {
    createRepositoryMock.mockReturnValue({
        readMeetupCandidates: async () => [],
        readRegistrations: async () => [],
        anonymise: async () => undefined,
        ...repository,
    })

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    let cron: string | undefined
    let job: (() => Promise<void>) | undefined
    const register = {
        schedule: (expression: string, callback: () => Promise<void>) => {
            cron = expression
            job = callback
        },
    }
    ;(registerHook as any)(register, { logger, env: { PUBLIC_URL: 'https://cms.example/' }, database })
    return { logger, cron, run: () => job!() }
}

describe('meetup-registration-retention hook', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('runs daily and logs the counts', async () => {
        const anonymise = jest.fn(async () => undefined)
        const { cron, run, logger } = setup({
            readMeetupCandidates: async () => [{ id: 'old', start_on: '2020-01-01T17:00:00Z', end_on: null }],
            readRegistrations: async () => [{ id: 'a', first_name: 'Ada', last_name: 'L', email: 'a@example.com' }],
            anonymise,
        })
        expect(cron).toBe(RETENTION_SCHEDULE)

        await run()

        expect(anonymise).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('anonymised 1 registration(s)'))
        expect(postSlackMessageMock).not.toHaveBeenCalled()
    })

    test('notifies Slack when the run fails', async () => {
        const { run, logger } = setup({
            readMeetupCandidates: async () => {
                throw new Error('db down')
            },
        })

        await run()

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('db down'))
        expect(postSlackMessageMock).toHaveBeenCalledWith(
            expect.stringContaining('https://cms.example/admin/content/meetup_registrations')
        )
    })

    test('notifies Slack when there is no database connection', async () => {
        const { run } = setup({}, null)
        await run()
        expect(postSlackMessageMock).toHaveBeenCalledWith(expect.stringContaining('No database connection'))
    })

    test('a failing Slack post is only logged', async () => {
        postSlackMessageMock.mockRejectedValueOnce(new Error('slack down'))
        const { run, logger } = setup({
            readMeetupCandidates: async () => {
                throw new Error('db down')
            },
        })
        await expect(run()).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('slack down'))
    })
})
