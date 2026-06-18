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

    if (!(env.ALGOLIA_APP_ID && env.ALGOLIA_API_KEY && env.ALGOLIA_INDEX)) {
        logger.warn(`${HOOK_NAME} hook: Did not set ALGOLIA_APP_ID && ALGOLIA_API_KEY && ALGOLIA_INDEX. Algolia extension will not be active.`)
        return
    }

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

    action('picks_of_the_day.items.create', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.pickOfTheDayHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('picks_of_the_day.items.update', async function (metadata, eventContext) {
        handleUpdateAction(metadata, eventContext, {
            handler: handlers.pickOfTheDayHandler,
            client,
            ItemsService,
            logger,
            env
        });
    })

    action('picks_of_the_day.items.delete', async function(metadata, eventContext) {
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

    // Directus passes `key` for single-item operations and `keys[]` for batch operations.
    const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
    if (!itemKey) {
        logger.error(`${HOOK_NAME} hook: Error: Invalid item key`)
        return
    }

    const { fields: collectionFields } = eventContext.schema.collections[metadata.collection]

    // ---------------------------------------------------------------------------------------------
    // Re-read the FULL item from the database and build the index entry from *that*.
    //
    // This is the heart of the fix. `metadata.payload` only contains the fields that changed in this
    // one save (the diff). Editors save title, cover, description and (for transcripts) the raw
    // transcript independently and in no fixed order, so any single save's payload is usually a tiny
    // subset of the item. Building the index entry from that subset used to:
    //   - create sparse podcast entries missing title/cover/date (only the changed field made it in),
    //     because `buildAttributes` reads `item.<field>` and missing fields serialize to `undefined`;
    //   - for transcripts, omit the related `podcast` metadata entirely and crash in
    //     `buildDistinctKey` (`item.podcast.id`) whenever the save didn't include the relation.
    //
    // Reading the full item via the handler's declared `indexFields` is exactly what the rebuild /
    // repair CLIs do, so the live hook and the CLIs now produce identical entries. `indexFields` is
    // the single source of truth for "what does this handler need to build an entry".
    const itemsService = new ItemsService(metadata.collection, {
        accountability: eventContext.accountability,
        schema: eventContext.schema,
    }) as ItemsServiceType;

    // `status` is requested only when the collection actually has the field — asking Directus for a
    // non-existent field throws.
    const fieldsToRead = collectionFields.status
        ? [...handler.indexFields, 'status']
        : [...handler.indexFields]

    const item = await itemsService.readOne(itemKey, { fields: fieldsToRead })

    // Only published items belong in the index. Action hooks run *after* the write, so the item we
    // just read already reflects the new status; there is no need to also inspect metadata.payload.
    if (collectionFields.status && item.status !== 'published') {
        logger.info(`${HOOK_NAME} hook: Item "${itemKey}" is not published (status: "${item.status}"). Ensuring it is absent from the search index.`)
        // Always issue the delete (it is idempotent): this covers depublishing as well as items that
        // were never indexed. We delete by the handler's deletion filter, NOT by a single objectID —
        // entries are stored as `<id>_0`, `<id>_1`, … (transcripts produce many chunks), so deleting
        // `objectID: itemKey` would have matched nothing.
        await deleteFromIndex({ handler, client, env, itemKey })
        return
    }

    // `updateRequired` is intentionally evaluated against the diff (metadata.payload): it answers
    // "did a field we index actually change in this save?" and lets us skip needless reindexing when
    // an unrelated field was touched. The index *content* is always built from the full item above.
    if (!handler.updateRequired(metadata.payload)) {
        logger.info(`${HOOK_NAME} hook: No search index update necessary`)
        return
    }

    const payloads = handler.buildAttributes(item).map((payload) => {
        return {
            ...payload,
            distinct: handler.buildDistinctKey(item),
            _directus_reference: handler.buildDirectusReference(item),
        }
    });

    // Some handlers (transcripts) expand one item into many chunk entries, and the number of chunks
    // can change between saves, so we delete the previous entries before re-creating them. Building
    // from the full item above is what makes this safe: previously a save without `service` +
    // `raw_response` produced zero chunks here, so this delete wiped the transcript and recreated
    // nothing.
    if (handler.requiresDistinctDeletionBeforeUpdate()) {
        await deleteFromIndex({ handler, client, env, itemKey })
    }

    try {
        await Promise.all(payloads.map(async (payload, index) => {
            await client.partialUpdateObject({
                indexName: env.ALGOLIA_INDEX,
                objectID: `${itemKey}_${index}`,
                attributesToUpdate: payload,
                createIfNotExists: true,
            });
        }));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`${HOOK_NAME} hook: Failed to update search index for "${handler.collectionName}" item "${itemKey}": ${errorMessage}`);
        throw error;
    }

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

    const deletedIds = await deleteFromIndex({ handler, client, env, itemKey })

    logger.info(`${HOOK_NAME} hook: Removed item(s) "${JSON.stringify(deletedIds)}" from search index via filter ${handler.buildDeletionFilter({ id: itemKey })}`)
}

/**
 * Removes every Algolia entry belonging to a single Directus item.
 *
 * Index entries are keyed `<id>_0`, `<id>_1`, … and one item (a transcript in particular) can map to
 * many of them, so we can't delete by a guessed objectID. Instead we look the entries up via the
 * handler's deletion filter (`_directus_reference:<id>`) and delete exactly those. Returns the list
 * of deleted objectIDs (empty when nothing matched). Shared by the depublish, distinct-rebuild and
 * delete paths so deletion behaves identically everywhere.
 */
async function deleteFromIndex(dependencies: {
    handler: ItemHandler,
    client: SearchClient,
    env,
    itemKey,
}): Promise<string[]> {
    const { handler, client, env, itemKey } = dependencies;

    const results = await client.browseObjects({
        indexName: env.ALGOLIA_INDEX,
        query: '',
        attributesToRetrieve: ['objectID'],
        browseParams: {
            filters: handler.buildDeletionFilter({ id: itemKey }),
        }
    });

    const idsForDeletion = results.hits.map((hit: any) => hit.objectID);
    if (idsForDeletion.length === 0) {
        return [];
    }

    await client.deleteObjects({
        indexName: env.ALGOLIA_INDEX,
        objectIDs: idsForDeletion,
    });

    return idsForDeletion;
}
