import { defineHook } from '@directus/extensions-sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
import { ItemHandler } from 'handlers/itemHandler.ts';
import { getHandlers } from './handlers/index.ts'
import { SearchClient } from 'algoliasearch';
const HOOK_NAME = 'algolia-index'

export default defineHook(({ action }, hookContext) => {

    const logger = hookContext.logger;
    const env = hookContext.env;
    //const ItemsService = hookContext.services.ItemsService;

    const handlers = getHandlers(env, logger);

    const client = searchClient(env.ALGOLIA_APP_ID, env.ALGOLIA_API_KEY, { requester: createFetchRequester() });

    action('podcasts.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.podcastHandler,
            client,
            logger,
            env
        });
    })

    action('podcasts.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.podcastHandler,
            client,
            logger,
            env
        });
    })

    action('podcasts.items.delete', async function (metadata) {
        const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
        if (!itemKey) {
            logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
            return
        }

        client.deleteObject({
            indexName: env.ALGOLIA_INDEX,
            objectID: itemKey,
        });

        logger.info(`${HOOK_NAME} hook: Removed item "${itemKey}" from search index`)
    })
});

async function handleUpdateAction(metadata, eventContext, dependencies: {
    handler: ItemHandler,
    client: SearchClient,
    logger,
    env
}){

    const {handler, client, logger, env} = dependencies;

    // Ensure metadata.key or metadata.keys[0] is not undefined
    const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
    if (!itemKey) {
        logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
        return
    }

    if (handler.updateRequired(metadata.payload)) {
        logger.info(`${HOOK_NAME} hook: No search index update necessary`)
    }

    await client.partialUpdateObject({
        indexName: env.ALGOLIA_INDEX,
        objectID: itemKey,
        attributesToUpdate: handler.buildAttributes(metadata.payload),
        createIfNotExists: true,
    });

    logger.info(`${HOOK_NAME} hook: Updated search index for "${handler.collectionName}" item "${itemKey}"`)
}
