import { handlePickOfTheDayAction } from './handlers/handlePickOfTheDayAction'
import { handlePodcastAction } from './handlers/handlePodcastAction'
import { handleTagAction } from './handlers/handleTagAction'
import type { ActionData, Context, Env, ItemsService, Logger, Payload } from './handlers/types'

const HOOK_NAME = 'buzzsproutApi'

export default (
    {
        action,
    }: {
        action: (event: string, handler: (data: ActionData<Payload>, context: Context) => Promise<void>) => void
    },
    {
        env,
        services,
    }: {
        env: Env
        services: {
            logger: Logger
            ItemsService: new (collection: string, options: any) => ItemsService
        }
    }
) => {
    const { logger, ItemsService } = services

    /**
     * It creates the podcast episode at Buzzsprout on
     * newly created podcast items, if necessary.
     */
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
     */
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
     */
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
     */
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
     */
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
     */
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
