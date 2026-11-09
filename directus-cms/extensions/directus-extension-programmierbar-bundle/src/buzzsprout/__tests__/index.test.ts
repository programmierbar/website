import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { handleBuzzsprout } from '../handlers/buzzsprout.ts'
import registerHook from '../index.ts'

// The extensions SDK ships as ESM and is not transformed under Jest's CJS mode,
// so stub it. The real `defineHook` simply returns its callback.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))

// `@directus/errors` ships as ESM; mock the wrapper (as the other hook tests do).
jest.mock('../../shared/errors.ts', () => ({
    createHookErrorConstructor: (_code: string, message: string) =>
        class extends Error {
            constructor() {
                super(message)
            }
        },
}))

// Stub the Buzzsprout API call so the test never reaches out to the network.
jest.mock('../handlers/buzzsprout.ts', () => ({
    handleBuzzsprout: jest.fn(),
}))

// Picks of the day and tags are irrelevant here; pass the podcast item through.
jest.mock('../handlers/podcastData.ts', () => ({
    getPodcastData: jest.fn(async (_hookName: string, podcastItem: unknown) => podcastItem),
}))

const handleBuzzsproutMock = jest.mocked(handleBuzzsprout)

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type Handler = (metadata: Record<string, any>, eventContext: Record<string, any>) => void

function setup(podcast: Record<string, any>) {
    // A single stored podcast row, shared by every ItemsService instance like a database.
    const row = { ...podcast }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const ItemsService = jest.fn().mockImplementation(() => ({
        readOne: jest.fn(async () => ({ ...row })),
        updateOne: jest.fn(async (_key: unknown, data: Record<string, any>) => {
            Object.assign(row, data)
        }),
    }))

    const handlers: Record<string, Handler> = {}
    const action = (event: string, handler: Handler) => {
        handlers[event] = handler
    }

    ;(registerHook as any)(
        { action },
        {
            logger,
            env: { BUZZSPROUT_API_URL: 'https://buzzsprout.test', BUZZSPROUT_API_TOKEN: 'token' },
            services: { ItemsService },
        }
    )

    return { handlers, row, logger }
}

describe('buzzsprout hook: podcasts', () => {
    beforeEach(() => {
        handleBuzzsproutMock.mockReset()
    })

    test('creates only one Buzzsprout episode for concurrent updates of the same podcast', async () => {
        // The Buzzsprout request takes a while, so a second event arrives before the
        // first one has stored the "buzzsprout_id".
        let finishCreate!: () => void
        handleBuzzsproutMock.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishCreate = () => resolve({ id: 4711, audio_url: 'https://buzzsprout.test/4711.mp3' })
                })
        )

        const { handlers, row, logger } = setup({
            id: 1,
            buzzsprout_id: null,
            status: 'draft',
            type: 'deep_dive',
            number: 219,
            title: 'Some Title',
            description: 'Some description',
            cover_image: 'cover-file',
            audio_file: 'audio-file',
        })
        const update = handlers['podcasts.items.update']!

        // What asset generation used to do: set the cover, then the assets status.
        update({ keys: [1], payload: { cover_image: 'cover-file' } }, { accountability: {} })
        update({ keys: [1], payload: { assets_status: 'complete' } }, { accountability: {} })

        await flush()
        finishCreate()
        await flush()

        expect(handleBuzzsproutMock).toHaveBeenCalledTimes(1)
        expect(row.buzzsprout_id).toBe(4711)
        expect(logger.error).not.toHaveBeenCalled()
    })

    test('still handles the next event after a failed one', async () => {
        handleBuzzsproutMock
            .mockRejectedValueOnce(new Error('Buzzsprout down'))
            .mockResolvedValueOnce({ id: 4711, audio_url: 'https://buzzsprout.test/4711.mp3' })

        const { handlers, row, logger } = setup({
            id: 1,
            buzzsprout_id: null,
            status: 'draft',
            type: 'deep_dive',
            number: 219,
            title: 'Some Title',
            description: 'Some description',
            cover_image: 'cover-file',
            audio_file: 'audio-file',
        })
        const update = handlers['podcasts.items.update']!

        update({ keys: [1], payload: { title: 'Some Title' } }, { accountability: {} })
        update({ keys: [1], payload: { title: 'Some Title' } }, { accountability: {} })
        await flush()

        expect(handleBuzzsproutMock).toHaveBeenCalledTimes(2)
        expect(row.buzzsprout_id).toBe(4711)
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Buzzsprout down'))
    })
})
