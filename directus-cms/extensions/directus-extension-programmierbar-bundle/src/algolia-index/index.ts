import { defineHook } from '@directus/extensions-sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
 import { ItemHandler } from 'handlers/ItemHandler.ts';
import { getHandlers } from './handlers/index.ts'
import { SearchClient } from 'algoliasearch';
import { ItemsService } from '../buzzsprout/handlers/types.js';
const HOOK_NAME = 'algolia-index'

export default defineHook(({ action }, hookContext) => {

    const logger = hookContext.logger;
    const env = hookContext.env;
    const ItemsService = hookContext.services.ItemsService;

    const handlers = getHandlers(env, logger);

    const client = searchClient(env.ALGOLIA_APP_ID, env.ALGOLIA_API_KEY, { requester: createFetchRequester() });

    action('podcasts.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.podcastHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('podcasts.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.podcastHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('podcasts.items.delete', async function(metadata) {
        handleDeleteAction(metadata, {
            client,
            logger,
            env
        })
    })

    action('meetups.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.meetupHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('meetups.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.meetupHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('meetups.items.delete', async function(metadata) {
        handleDeleteAction(metadata, {
            client,
            logger,
            env
        })
    })

    action('speakers.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.speakerHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('speakers.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.speakerHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('speakers.items.delete', async function(metadata) {
        handleDeleteAction(metadata, {
            client,
            logger,
            env
        })
    })

    action('picks_pf_the_day.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.pickOfTheDayHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('picks_pf_the_day.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.pickOfTheDayHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('picks_pf_the_day.items.delete', async function(metadata) {
        handleDeleteAction(metadata, {
            client,
            logger,
            env
        })
    })
});

async function handleUpdateAction(metadata, eventContext, dependencies: {
    handler: ItemHandler,
    client: SearchClient,
    ItemsService: ItemsService,
    logger,
    env
}){

    const {handler, ItemsService, client, logger, env} = dependencies;

    // Ensure metadata.key or metadata.keys[0] is not undefined
    const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
    if (!itemKey) {
        logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
        return
    }

    // Get fields of collection
    const { fields } = eventContext.schema.collections[metadata.collection]

    if (fields.status) {
        // Create items service instance
        const itemsService = new ItemsService(metadata.collection, {
            accountability: eventContext.accountability,
            schema: eventContext.schema,
        })

        // Get item from item service by key
        const item = await itemsService.readOne(itemKey)

        if ((item.status !== 'published' && metadata.payload.status !== 'published')) {
            logger.info(`${HOOK_NAME} hook: No search index update necessary, item is not published yet.`)

            if (metadata.payload.status === 'draft' || metadata.payload.status === 'archived') {
                logger.info(`${HOOK_NAME} hook: Item has been depublished. Removing it from search index.`)
                client.deleteObject({
                    indexName: env.ALGOLIA_INDEX,
                    objectID: itemKey,
                });
            }
            return
        }
    }

    if (!handler.updateRequired(metadata.payload)) {
        logger.info(`${HOOK_NAME} hook: No search index update necessary`)
        return
    }

    await client.partialUpdateObject({
        indexName: env.ALGOLIA_INDEX,
        objectID: itemKey,
        attributesToUpdate: handler.buildAttributes(metadata.payload),
        createIfNotExists: true,
    });

    logger.info(`${HOOK_NAME} hook: Updated search index "${env.ALGOLIA_INDEX}" for "${handler.collectionName}" item "${itemKey}"`)
}

function handleDeleteAction(metadata, dependencies: {
    client: SearchClient,
    logger,
    env
}) {
    const {client, logger, env} = dependencies;

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
}
