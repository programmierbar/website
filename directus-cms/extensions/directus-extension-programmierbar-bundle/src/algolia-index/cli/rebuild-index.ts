#!/usr/bin/env node

import meow from 'meow';
import { createDirectus, rest } from '@directus/sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
import 'dotenv/config'

import { getHandlers } from './../handlers/index.ts';
import { streamItems } from './../util/pagination.ts';

const cli = meow(`
    Usage
        $ npm run algolia:rebuild-index <collection>

    Examples
      $ npm run algolia:rebuild-index podcasts
`,
    {
        importMeta: import.meta,
    });

const PUBLIC_URL = process.env.PUBLIC_URL;
const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX;
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;

if (!PUBLIC_URL || !ALGOLIA_INDEX || !ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
    throw new Error('Missing environment variables');
}

if (cli.input.length === 0) {
    throw new Error('No collection specified.');
}


const algoliaClient = searchClient(ALGOLIA_APP_ID, ALGOLIA_API_KEY, { requester: createFetchRequester() });
const directusClient = createDirectus(PUBLIC_URL).with(rest());

const itemHandlers = getHandlers({
    PUBLIC_URL: PUBLIC_URL,
}, {});

// The fields to fetch are taken from each handler's `indexFields` (the single source of truth shared
// with the live hook), so the CLI can never drift out of sync with what the handler actually reads.
const configuration = [
    { collection: 'podcasts', handler: itemHandlers.podcastHandler },
    { collection: 'meetups', handler: itemHandlers.meetupHandler },
    { collection: 'speakers', handler: itemHandlers.speakerHandler },
    { collection: 'picks_of_the_day', handler: itemHandlers.pickOfTheDayHandler },
    { collection: 'transcripts', handler: itemHandlers.transcriptHandler },
]

for (const configurationItem of configuration) {
    if (cli.input.lastIndexOf(configurationItem.collection) !== -1) {
        console.log('Rebuilding index for collection: ' + configurationItem.collection);

        // Stream the collection page by page (page size decided by the handler) instead of loading
        // it all at once. Transcripts in particular cannot be read with `limit: -1` — each row holds
        // a full hour of audio transcription. Streaming also keeps memory bounded: we process and
        // push one item before fetching the next.
        let counter = 0;
        for await (const item of streamItems(directusClient, configurationItem.collection, configurationItem.handler)) {
            counter++;
            const payloads = configurationItem.handler.buildAttributes(item).map((payload) => {
                return {
                    ...payload,
                    distinct: configurationItem.handler.buildDistinctKey(item),
                    _directus_reference: configurationItem.handler.buildDirectusReference(item),
                }
            });

            // Transcripts (and any handler that fans an item out into a VARIABLE number of objects)
            // must delete the item's existing entries first: when the chunk count shrinks, the
            // now-orphaned `${id}_N` records would otherwise linger. Single-object collections
            // (meetups, podcasts, ...) don't need this — the full-record replace below overwrites
            // their one `${id}_0` entry in place.
            if (configurationItem.handler.requiresDistinctDeletionBeforeUpdate()) {
                const results = await algoliaClient.browseObjects({
                    indexName: ALGOLIA_INDEX,
                    query: '',
                    attributesToRetrieve: [
                        'objectID',
                    ],
                    browseParams: {
                        filters:  configurationItem.handler.buildDeletionFilter(item),
                    }
                });

                const IdsForDeletion = results.hits.map((hit: any) => hit.objectID);
                await algoliaClient.deleteObjects({
                    indexName: ALGOLIA_INDEX,
                    objectIDs: IdsForDeletion,
                });
            }

            // Write each payload as a FULL-RECORD REPLACE (addOrUpdateObject = PUT), NOT a partial
            // merge. This is a correctness fix, not a style choice: partialUpdateObject MERGES into the
            // stored record, and Algolia refuses to merge into a record that is already over its 10 KB
            // limit — so a stale, oversized entry (e.g. an old meetup indexed with a full raw-HTML
            // description) could never shrink itself, however much the source text was trimmed; the
            // write was rejected citing the EXISTING record's size. A full replace overwrites the whole
            // record (dropping any stale attributes too) and is accepted as long as the NEW payload
            // fits — which the handlers' size guards ensure.
            await Promise.all(payloads.map(async (payload, index) => {
                await algoliaClient.addOrUpdateObject({
                    indexName: ALGOLIA_INDEX,
                    objectID: `${item.id}_${index}`,
                    body: payload,
                });
            }));

            console.log(`Processed ${configurationItem.collection.slice(0, -1)} (${counter}): ${item.id}`);
            console.log(payloads);
            console.log('-----');
        }

        console.log('Rebuilt index for collection: ' + configurationItem.collection);
    }
}
