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

    // Talks are their own collection embedded into meetups (see MeetupHandler). Editing a talk's
    // title/abstract must refresh the meetup entries that embed it — see handleRelatedTalkChange for
    // why only `update` is wired up (create/delete are covered by the accompanying meetup update).
    action('talks.items.update', async function (metadata, eventContext) {
        handleRelatedTalkChange(metadata, eventContext, {
            meetupHandler: handlers.meetupHandler,
            client,
            ItemsService,
            logger,
            env
        });
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

    // The actual reindex lives in reindexByKey (shared with the talk-change path). We pass the change
    // payload so it can skip needless work when no indexed field changed.
    await reindexByKey({
        handler,
        collection: metadata.collection,
        itemKey,
        eventContext,
        ItemsService,
        client,
        logger,
        env,
        changedPayload: metadata.payload,
    })
}

/**
 * Reads the FULL item from the database and (re)builds its Algolia entry from *that* item.
 *
 * This is the heart of the indexing fix. `metadata.payload` only contains the fields that changed in
 * a single save (the diff). Editors save title, cover, description and (for transcripts) the raw
 * transcript independently and in no fixed order, so any one save's payload is usually a tiny subset
 * of the item. Building the entry from that subset used to:
 *   - create sparse podcast entries missing title/cover/date (only the changed field made it in),
 *     because `buildAttributes` reads `item.<field>` and missing fields serialize to `undefined`;
 *   - for transcripts, omit the related `podcast` metadata entirely and crash in `buildDistinctKey`
 *     (`item.podcast.id`) whenever the save didn't include the relation.
 *
 * Reading the full item via the handler's declared `indexFields` is exactly what the rebuild / repair
 * CLIs do, so the live hook and the CLIs produce identical entries. `indexFields` is the single
 * source of truth for "what does this handler need to build an entry".
 *
 * `changedPayload` is the diff that triggered the reindex, used only to gate needless work. Callers
 * that can't supply a meaningful diff (e.g. a meetup reindexed because one of its talks changed)
 * omit it, which forces a rebuild.
 */
async function reindexByKey(dependencies: {
    handler: ItemHandler,
    collection: string,
    itemKey: any,
    eventContext: any,
    ItemsService,
    client: SearchClient,
    logger,
    env,
    changedPayload?: any,
}): Promise<void> {
    const { handler, collection, itemKey, eventContext, ItemsService, client, logger, env, changedPayload } = dependencies;

    const { fields: collectionFields } = eventContext.schema.collections[collection]

    const itemsService = new ItemsService(collection, {
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
    // just read already reflects the new status; there is no need to also inspect the diff.
    if (collectionFields.status && item.status !== 'published') {
        logger.info(`${HOOK_NAME} hook: Item "${itemKey}" is not published (status: "${item.status}"). Ensuring it is absent from the search index.`)
        // Always issue the delete (it is idempotent): this covers depublishing as well as items that
        // were never indexed. We delete by the handler's deletion filter, NOT by a single objectID —
        // entries are stored as `<id>_0`, `<id>_1`, … (transcripts produce many chunks), so deleting
        // `objectID: itemKey` would have matched nothing.
        await deleteFromIndex({ handler, client, env, itemKey })
        return
    }

    // When triggered by a direct edit we gate on the diff: `updateRequired` answers "did a field we
    // index actually change in this save?" and lets us skip needless reindexing when an unrelated
    // field was touched. Talk-driven reindexes pass no diff and always rebuild (the meetup row itself
    // may not have changed at all, only the related talk's text).
    if (changedPayload !== undefined && !handler.updateRequired(changedPayload)) {
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

/**
 * Reindexes the meetups that embed a talk whose content just changed.
 *
 * Talk title/abstract live in the standalone `talks` collection (shared by meetups and conferences),
 * so editing a talk fires `talks.items.*` — NOT `meetups.items.*`. Without this handler, a talk edit
 * would never refresh the meetup entries that embed its text. We resolve every meetup linked to the
 * changed talk via the talk's reverse `meetups` alias (the `meetups_talks` junction) and rebuild each.
 *
 * Scope: wired to `talks.items.update` only.
 *   - create: a brand-new talk isn't linked to a meetup yet; linking happens through a meetup save
 *     (`meetups.items.update` with `talks` in the payload), already handled via updateRequired.
 *   - delete: the talk can no longer be read to find its meetups; Directus removes the junction rows,
 *     which updates the meetups' `talks` field and triggers `meetups.items.update` to refresh them.
 */
async function handleRelatedTalkChange(metadata, eventContext, dependencies: {
    meetupHandler: ItemHandler,
    client: SearchClient,
    ItemsService,
    logger,
    env
}) {
    const { meetupHandler, client, ItemsService, logger, env } = dependencies;

    const talkKey = metadata.key || (metadata.keys && metadata.keys[0])
    if (!talkKey) {
        logger.error(`${HOOK_NAME} hook: Error: Invalid talk key`)
        return
    }

    // Skip talk saves that don't touch indexed talk fields (e.g. only the video URL or thumbnail
    // changed) — those can't affect any meetup entry.
    const payload = metadata.payload || {}
    if (payload.title === undefined && payload.abstract === undefined) {
        logger.info(`${HOOK_NAME} hook: Talk "${talkKey}" change does not affect indexed fields; skipping.`)
        return
    }

    const talksService = new ItemsService('talks', {
        accountability: eventContext.accountability,
        schema: eventContext.schema,
    }) as ItemsServiceType;

    // `meetups` is the talk's reverse M2M alias → rows of the `meetups_talks` junction, each with a
    // `meetup` id.
    const talk = await talksService.readOne(talkKey, { fields: ['meetups.meetup'] })
    const meetupIds = (talk?.meetups ?? [])
        .map((row: any) => row?.meetup)
        .filter(Boolean)

    if (meetupIds.length === 0) {
        logger.info(`${HOOK_NAME} hook: Talk "${talkKey}" is not linked to any meetup; nothing to reindex.`)
        return
    }

    logger.info(`${HOOK_NAME} hook: Talk "${talkKey}" changed; reindexing ${meetupIds.length} linked meetup(s).`)

    for (const meetupId of meetupIds) {
        // No changedPayload → always rebuild: the meetup row itself hasn't changed, only the talk text.
        await reindexByKey({
            handler: meetupHandler,
            collection: 'meetups',
            itemKey: meetupId,
            eventContext,
            ItemsService,
            client,
            logger,
            env,
        })
    }
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
