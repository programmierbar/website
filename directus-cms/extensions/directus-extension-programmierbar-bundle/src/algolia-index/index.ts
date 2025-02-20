import { defineHook } from '@directus/extensions-sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
 import { ItemHandler } from './handlers/ItemHandler.ts';
import { getHandlers } from './handlers/index.ts'
import { SearchClient } from 'algoliasearch';
import { ItemsService as ItemsServiceType } from '../buzzsprout/handlers/types.js';
const HOOK_NAME = 'algolia-index'

export default defineHook(({ action }, hookContext) => {

    const logger = hookContext.logger;
    const env = hookContext.env;
    const ItemsService = hookContext.services.ItemsService satisfies ItemsServiceType;

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

    action('podcasts.items.delete', async function(metadata, eventContext) {
        handleDeleteAction(metadata, eventContext, {
            handler: handlers.podcastHandler,
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

    action('meetups.items.delete', async function(metadata, eventContext) {
        handleDeleteAction(metadata, eventContext, {
            handler: handlers.meetupHandler,
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

    action('speakers.items.delete', async function(metadata, eventContext) {
        handleDeleteAction(metadata, eventContext, {
            handler: handlers.speakerHandler,
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

    action('picks_pf_the_day.items.delete', async function(metadata, eventContext) {
        handleDeleteAction(metadata, eventContext, {
            handler: handlers.pickOfTheDayHandler,
            client,
            logger,
            env
        })
    })

    action('transcripts.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.transcriptHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('transcripts.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.transcriptHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('transcripts.items.delete', async function(metadata, eventContext) {
        handleDeleteAction(metadata, eventContext, {
            handler: handlers.transcriptHandler,
            client,
            logger,
            env
        })
    })
});

async function handleUpdateAction(metadata, eventContext, dependencies: {
    handler: ItemHandler,
    client: SearchClient,
    ItemsService,
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
        }) as ItemsServiceType;

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
            } else {
                // logger.warm(`${HOOK_NAME} hook: Encountered unknown item status`)
                //throw new Error('Encountered unknown item status.')
            }

            return
        }
    }

    if (!handler.updateRequired(metadata.payload)) {
        logger.info(`${HOOK_NAME} hook: No search index update necessary`)
        return
    }

    const payloads = handler.buildAttributes(metadata.payload).map((payload) => {
        return {
            ...payload,
            distinct: handler.buildDistinctKey({
                ...metadata.payload,
                id: itemKey
            }),
            _directus_reference: handler.buildDirectusReference({
                ...metadata.payload,
                id: itemKey
            }),
        }
    });

    if (handler.requiresDistinctDeletionBeforeUpdate()) {
        const results = await client.browseObjects({
            indexName: env.ALGOLIA_INDEX,
            query: '',
            attributesToRetrieve: [
                'objectID',
            ],
            browseParams: {
                filters:  handler.buildDeletionFilter({id: itemKey}),
            }
        });

        const IdsForDeletion = results.hits.map((hit: any) => hit.objectID);
        await client.deleteObjects({
            indexName: env.ALGOLIA_INDEX,
            objectIDs: IdsForDeletion,
        });
    }

    payloads.forEach(async (payload, index) => {
        await client.partialUpdateObject({
            indexName: env.ALGOLIA_INDEX,
            objectID: `${itemKey}_${index}`,
            attributesToUpdate: payload,
            createIfNotExists: true,
        });
    });

    logger.info(`${HOOK_NAME} hook: Updated search index "${env.ALGOLIA_INDEX}" for "${handler.collectionName}" item "${itemKey}"`)
}

async function handleDeleteAction(metadata, eventContext, dependencies: {
    handler: ItemHandler,
    client: SearchClient,
    logger,
    env
}) {
    const {handler, client, logger, env} = dependencies;

    const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
    if (!itemKey) {
        logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
        return
    }

    const item = {id: itemKey};

    const results = await client.browseObjects({
        indexName: env.ALGOLIA_INDEX,
        query: '',
        attributesToRetrieve: [
            'objectID',
        ],
        browseParams: {
            filters: handler.buildDeletionFilter(item),
        }
    });

    const IdsForDeletion = results.hits.map((hit: any) => hit.objectID);
    await client.deleteObjects({
        indexName: env.ALGOLIA_INDEX,
        objectIDs: IdsForDeletion,
    });

    logger.info(`${HOOK_NAME} hook: Removed item(s) "${JSON.stringify(IdsForDeletion)}" from search index via filter ${handler.buildDeletionFilter(item)}`)
}
