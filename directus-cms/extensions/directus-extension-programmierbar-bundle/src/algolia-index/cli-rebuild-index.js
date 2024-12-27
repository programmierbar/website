import { createDirectus, rest, readItems } from '@directus/sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
import 'dotenv/config'

const algoliaClient = searchClient(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY, { requester: createFetchRequester() });

const directusClient = createDirectus(process.env.PUBLIC_URL).with(rest());

const podcastItems = await directusClient.request(
    readItems('podcasts', {
        fields: ['id', 'title', 'slug', 'description', 'type', 'published_on', 'cover_image'],
        limit: 10,
    })
);

for (const podcastItem of podcastItems) {
    const payload = {
        title: podcastItem.title,
        description: podcastItem.description,
        type: podcastItem.type,
        published_on: podcastItem.published_on,
        image: podcastItem.cover_image ? `${process.env.PUBLIC_URL}assets/${podcastItem.cover_image}` : undefined,
        url: podcastItem.slug ? `${process.env.PUBLIC_URL}podcast/${podcastItem.slug}` : undefined,
    }

    await algoliaClient.partialUpdateObject({
        indexName: process.env.ALGOLIA_INDEX,
        objectID: podcastItem.id,
        attributesToUpdate: payload,
        createIfNotExists: true,
    });

    console.log('Processed item: ' + podcastItem.id);
    console.log(payload);
    console.log('-----');
}
