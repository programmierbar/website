#!/usr/bin/env node

import meow from 'meow';
import { createDirectus, rest, readItems } from '@directus/sdk';
import { createFetchRequester } from '@algolia/requester-fetch';
import { searchClient } from '@algolia/client-search';
import 'dotenv/config'

import { getHandlers } from './../handlers/index.ts';

const cli = meow(`
    Usage
        $ npm run algolia:repair-index <collection>

    Arguments
        collection    Collection name to repair (podcasts, meetups, speakers, picks_of_the_day, transcripts, or 'all')

    Examples
      $ npm run algolia:repair-index podcasts
      $ npm run algolia:repair-index all
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

const configuration = [
    {
        collection: 'podcasts',
        fields: ['id', 'title', 'slug', 'description', 'number', 'type', 'published_on', 'cover_image'],
        handler: itemHandlers.podcastHandler,
    },
    {
        collection: 'meetups',
        fields: ['id', 'title', 'slug', 'description', 'published_on', 'cover_image'],
        handler: itemHandlers.meetupHandler,
    },
    {
        collection: 'speakers',
        fields: ['id', 'first_name', 'last_name', 'academic_title', 'description', 'published_on', 'slug', 'profile_image'],
        handler: itemHandlers.speakerHandler,
    },
    {
        collection: 'picks_of_the_day',
        fields: ['id', 'name', 'website_url', 'description', 'published_on', 'image'],
        handler: itemHandlers.pickOfTheDayHandler,
    },
    {
        collection: 'transcripts',
        fields: ['id', 'podcast.*', 'speakers.*', 'service', 'supported_features', 'raw_response'],
        handler: itemHandlers.transcriptHandler,
    },
];

interface RepairStats {
    collection: string;
    totalDbItems: number;
    totalIndexItems: number;
    missing: number;
    stale: number;
    orphaned: number;
    repaired: number;
}

async function repairCollection(configItem: typeof configuration[0]): Promise<RepairStats> {
    const stats: RepairStats = {
        collection: configItem.collection,
        totalDbItems: 0,
        totalIndexItems: 0,
        missing: 0,
        stale: 0,
        orphaned: 0,
        repaired: 0,
    };

    console.log(`\n🔍 Analyzing collection: ${configItem.collection}`);

    // Get all items from Directus
    const dbItems = await directusClient.request(
        readItems(configItem.collection, {
            fields: configItem.fields,
            limit: -1,
        })
    );

    stats.totalDbItems = dbItems.length;
    console.log(`📊 Found ${stats.totalDbItems} items in database`);

    // Get all items from Algolia index for this collection
    const indexItems = await algoliaClient.browseObjects({
        indexName: ALGOLIA_INDEX,
        browseParams: {
            filters: `_type:${configItem.handler.collectionName === 'podcasts' ? 'podcast' : configItem.handler.collectionName.slice(0, -1)}`,
        }
    });

    stats.totalIndexItems = indexItems.hits.length;
    console.log(`📊 Found ${stats.totalIndexItems} items in search index`);

    // Create maps for efficient lookups
    const dbItemsMap = new Map(dbItems.map(item => [item.id, item]));
    const indexItemsMap = new Map();

    // Group index items by their directus reference
    for (const hit of indexItems.hits) {
        const ref = hit._directus_reference;
        if (!indexItemsMap.has(ref)) {
            indexItemsMap.set(ref, []);
        }
        indexItemsMap.get(ref).push(hit);
    }

    console.log('\n🔍 Identifying issues...');

    // Find missing items (in DB but not in index)
    const missingItems = [];
    for (const [itemId, dbItem] of dbItemsMap) {
        if (!indexItemsMap.has(String(itemId))) {
            missingItems.push(dbItem);
            stats.missing++;
        }
    }

    // Find orphaned items (in index but not in DB)
    const orphanedItems = [];
    for (const [ref, hits] of indexItemsMap) {
        if (!dbItemsMap.has(Number(ref))) {
            orphanedItems.push(...hits);
            stats.orphaned += hits.length;
        }
    }

    // Find stale items (different data)
    const staleItems = [];
    for (const [itemId, dbItem] of dbItemsMap) {
        const indexHits = indexItemsMap.get(String(itemId));
        if (indexHits) {
            // Check if we need to update (simplified check)
            if (configItem.handler.updateRequired(dbItem)) {
                const expectedPayloads = configItem.handler.buildAttributes(dbItem);
                if (expectedPayloads.length !== indexHits.length) {
                    staleItems.push(dbItem);
                    stats.stale++;
                }
            }
        }
    }

    console.log(`❌ Missing in index: ${stats.missing}`);
    console.log(`🗑️  Orphaned in index: ${stats.orphaned}`);
    console.log(`⚠️  Potentially stale: ${stats.stale}`);

    return stats;


    // Repair missing items
    if (missingItems.length > 0) {
        console.log('\n🔧 Adding missing items to index...');
        for (const item of missingItems) {
            await addItemToIndex(item, configItem);
            stats.repaired++;
            console.log(`✅ Added ${configItem.collection} item ${item.id}`);
        }
    }

    // Remove orphaned items
    if (orphanedItems.length > 0) {
        console.log('\n🧹 Removing orphaned items from index...');
        const orphanedIds = orphanedItems.map(hit => hit.objectID);
        await algoliaClient.deleteObjects({
            indexName: ALGOLIA_INDEX,
            objectIDs: orphanedIds,
        });
        stats.repaired += orphanedItems.length;
        console.log(`✅ Removed ${orphanedItems.length} orphaned items`);
    }

    // Repair stale items
    if (staleItems.length > 0) {
        console.log('\n🔄 Updating stale items in index...');
        for (const item of staleItems) {
            await updateItemInIndex(item, configItem);
            stats.repaired++;
            console.log(`✅ Updated ${configItem.collection} item ${item.id}`);
        }
    }

    return stats;
}

async function addItemToIndex(item: any, configItem: typeof configuration[0]) {
    const payloads = configItem.handler.buildAttributes(item).map((payload) => {
        return {
            ...payload,
            distinct: configItem.handler.buildDistinctKey(item),
            _directus_reference: configItem.handler.buildDirectusReference(item),
        }
    });

    await Promise.all(payloads.map(async (payload, index) => {
        await algoliaClient.partialUpdateObject({
            indexName: ALGOLIA_INDEX,
            objectID: `${item.id}_${index}`,
            attributesToUpdate: payload,
            createIfNotExists: true,
        });
    }));
}

async function updateItemInIndex(item: any, configItem: typeof configuration[0]) {
    // First remove existing entries if required
    if (configItem.handler.requiresDistinctDeletionBeforeUpdate()) {
        const results = await algoliaClient.browseObjects({
            indexName: ALGOLIA_INDEX,
            browseParams: {
                filters: configItem.handler.buildDeletionFilter(item),
            }
        });

        const idsForDeletion = results.hits.map((hit: any) => hit.objectID);
        if (idsForDeletion.length > 0) {
            await algoliaClient.deleteObjects({
                indexName: ALGOLIA_INDEX,
                objectIDs: idsForDeletion,
            });
        }
    }

    // Then add the updated item
    await addItemToIndex(item, configItem);
}

// Main execution
async function main() {
    const requestedCollection = cli.input[0];
    const allStats: RepairStats[] = [];

    for (const configItem of configuration) {
        if (requestedCollection === 'all' || configItem.collection === requestedCollection) {
            try {
                const stats = await repairCollection(configItem);
                allStats.push(stats);
            } catch (error) {
                console.error(`❌ Failed to repair ${configItem.collection}:`, error);
            }
        }
    }

    // Print summary
    console.log('\n📊 REPAIR SUMMARY');
    console.log('================');

    let totalRepaired = 0;
    for (const stats of allStats) {
        console.log(`${stats.collection}: ${stats.repaired} items repaired`);
        totalRepaired += stats.repaired;
    }

    console.log(`\n🎉 Total items repaired: ${totalRepaired}`);

    if (totalRepaired === 0) {
        console.log('✨ Search index is already in sync!');
    }
}

main().catch(console.error);
