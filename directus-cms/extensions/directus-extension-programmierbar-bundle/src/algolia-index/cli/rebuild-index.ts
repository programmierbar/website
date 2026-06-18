#!/usr/bin/env node

import meow from 'meow';
import { createDirectus, rest, readItems } from '@directus/sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
import 'dotenv/config'

import { getHandlers } from './../handlers/index.ts';

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

        const items = await directusClient.request(
            readItems(configurationItem.collection, {
                fields: configurationItem.handler.indexFields,
                limit: -1,
            })
        );

        let counter = 0;
        for (const item of items) {
            counter++;
            const payloads = configurationItem.handler.buildAttributes(item).map((payload) => {
                return {
                    ...payload,
                    distinct: configurationItem.handler.buildDistinctKey(item),
                    _directus_reference: configurationItem.handler.buildDirectusReference(item),
                }
            });

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

            await Promise.all(payloads.map(async (payload, index) => {
                await algoliaClient.partialUpdateObject({
                    indexName: ALGOLIA_INDEX,
                    objectID: `${item.id}_${index}`,
                    attributesToUpdate: payload,
                    createIfNotExists: true,
                });
            }));

            console.log(`Processed ${configurationItem.collection.slice(0, -1)} (${counter}): ${item.id}`);
            console.log(payloads);
            console.log('-----');
        }

        console.log('Rebuilt index for collection: ' + configurationItem.collection);
    }
}
