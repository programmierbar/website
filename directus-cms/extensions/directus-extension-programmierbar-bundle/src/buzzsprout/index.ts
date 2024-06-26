import { defineHook } from '@directus/extensions-sdk'
//import { handlePickOfTheDayAction } from './handlers/handlePickOfTheDayAction'
import { handlePodcastAction } from './handlers/handlePodcastAction.ts'
//import { handleTagAction } from './handlers/handleTagAction'

const HOOK_NAME = 'buzzsprout'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger;
    const env = hookContext.env;
    const ItemsService = hookContext.services.ItemsService;

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
})

/**
export default (
    {
        action,
    }: {
        action: (event: string, handler: (data: ActionData<Payload>, context: Context) => Promise<void>) => void
    },
    {
        env,
        logger,
        services,
    }: {
        env: Env,
        logger: Logger,
        services: {
            ItemsService: new (collection: string, options: any) => ItemsService
        }
    }
) => {
    const { ItemsService } = services

    /**
     * It creates the podcast episode at Buzzsprout on
     * newly created podcast items, if necessary.
     *
    action('podcasts.items.create', async ({ payload, metadata, context }: ActionData<Payload>) =>
        handlePodcastAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'podcasts' },
                context,
            },
            { logger, ItemsService, env }
        )
    )

    /**
     * It creates or updates the podcast episode at Buzzsprout
     * on updated podcast items, if necessary.
     *
    action('podcasts.items.update', async ({ payload, metadata, context }: ActionData<Payload>) =>
        handlePodcastAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'podcasts' },
                context,
            },
            { logger, ItemsService, env }
        )
    )

    /**
     * It updates the podcast episode at Buzzsprout on newly
     * created pick of the day items, if necessary.
     *
    action('picks_of_the_day.items.create', async ({ payload, metadata, context }: ActionData<Payload>) =>
        handlePickOfTheDayAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'picks_of_the_day' },
                context,
            },
            { ItemsService, logger, env }
        )
    )

    /**
     * It updates the podcast episode at Buzzsprout on
     * updated pick of the day items, if necessary.
     *
    action('picks_of_the_day.items.update', async ({ payload, metadata, context }: ActionData<Payload>) =>
        handlePickOfTheDayAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'picks_of_the_day' },
                context,
            },
            { ItemsService, logger, env }
        )
    )

    /**
     * It updates the podcast episode at Buzzsprout
     * on created tag items, if necessary.
     *
    action('tags.items.create', async ({ payload, metadata, context }: ActionData<Payload>) =>
        handleTagAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'tags' },
                context,
            },
            { ItemsService, logger, env }
        )
    )

    /**
     * It updates the podcast episode at Buzzsprout
     * on updated tag items, if necessary.
     *
    action('tags.items.update', async ({ payload, metadata, context }: ActionData<Payload>) =>
        handleTagAction(
            HOOK_NAME,
            {
                payload,
                metadata: { ...metadata, collection: 'tags' },
                context,
            },
            { ItemsService, logger, env }
        )
    )
}

 */
