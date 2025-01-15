import { createDirectus, rest, readItems } from '@directus/sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
import 'dotenv/config'

import { getHandlers } from './handlers/index.ts';

const PUBLIC_URL = process.env.PUBLIC_URL;
const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX;
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;

if (!PUBLIC_URL || !ALGOLIA_INDEX || !ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
    throw new Error('Missing environment variables');
}

const algoliaClient = searchClient(ALGOLIA_APP_ID, ALGOLIA_API_KEY, { requester: createFetchRequester() });
const directusClient = createDirectus(PUBLIC_URL).with(rest());

const itemHandlers = getHandlers({
    PUBLIC_URL: PUBLIC_URL,
}, {});

const podcastItems = await directusClient.request(
    readItems('podcasts', {
        fields: ['id', 'title', 'slug', 'description', 'type', 'published_on', 'cover_image'],
        limit: -1,
    })
);

let counter = 0;
for (const podcastItem of podcastItems) {
    counter++;
    const payload = itemHandlers.podcastHandler.buildAttributes(podcastItem);

    await algoliaClient.partialUpdateObject({
        indexName: ALGOLIA_INDEX,
        objectID: podcastItem.id,
        attributesToUpdate: payload,
        createIfNotExists: true,
    });

    console.log('Processed podcast (' + counter + ') item: ' + podcastItem.id);
    console.log(payload);
    console.log('-----');
}
