import { defineHook } from '@directus/extensions-sdk'
import { handlePickOfTheDayAction } from './handlers/handlePickOfTheDayAction.ts'
import { handlePodcastAction } from './handlers/handlePodcastAction.ts'
import { handleTagAction } from './handlers/handleTagAction.ts'

const HOOK_NAME = 'buzzsprout'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger;
    const env = hookContext.env;
    const ItemsService = hookContext.services.ItemsService;

    if (!(env.BUZZSPROUT_API_URL && env.BUZZSPROUT_API_TOKEN)) {
        logger.warn(`${HOOK_NAME} hook: Did not set BUZZSPROUT_API_URL && BUZZSPROUT_API_TOKEN. Buzzsprout extension will not be active.`)
        return
    }

    action('podcasts.items.create', function (metadata, eventContext) {
        const { payload } = metadata
        handlePodcastAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'podcasts' },
                context: eventContext,
            },
            { logger, ItemsService, env }
        )
    })
    action('podcasts.items.update', function (metadata, eventContext) {
        const { payload } = metadata
        handlePodcastAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'podcasts' },
                context: eventContext,
            },
            { logger, ItemsService, env }
        )
    })

    action('picks_of_the_day.items.create', function (metadata, eventContext) {
        const { payload } = metadata
        handlePickOfTheDayAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'picks_of_the_day' },
                context: eventContext,
            },
            { logger, ItemsService, env }
        )
    })
    action('picks_of_the_day.items.update', function (metadata, eventContext) {
        const { payload } = metadata
        handlePickOfTheDayAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'picks_of_the_day' },
                context: eventContext,
            },
            { logger, ItemsService, env }
        )
    })

    action('tags.items.create', function (metadata, eventContext) {
        const { payload } = metadata
        handleTagAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'tags' },
                context: eventContext,
            },
            { logger, ItemsService, env }
        )
    })
    action('tags.items.update', function (metadata, eventContext) {
        const { payload } = metadata
        handleTagAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'tags' },
                context: eventContext,
            },
            { logger, ItemsService, env }
        )
    })
})

