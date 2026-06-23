import { readItems } from '@directus/sdk';
import type { ItemHandler } from '../handlers/ItemHandler.ts';

// Shared bulk-read helpers for the rebuild/repair CLIs.
//
// Whether and how a collection is paged is decided by the handler (handler.pageSize), so the two CLIs
// stay in lock-step and never reimplement pagination differently. A handler returning a page size of
// `<= 0` opts out of pagination and is read in a single `limit: -1` request; a positive page size is
// read page by page.
//
// The fields fetched come from `handler.indexFields` — the same single source of truth the live hook
// uses — so a rebuilt/repaired item is built from exactly the fields the handler expects.

/**
 * Streams a collection's items one page at a time. Prefer this over {@link collectItems} whenever the
 * caller can process items as they arrive (e.g. the rebuild CLI pushes each item to Algolia and moves
 * on), because it never holds more than a single page in memory. This is what makes rebuilding the
 * transcript index — where each row carries a full hour of audio transcription — feasible.
 */
export async function* streamItems(
    client: any,
    collection: string,
    handler: ItemHandler,
): AsyncGenerator<any> {
    const pageSize = handler.pageSize;

    // No pagination: fetch the whole collection in one request.
    if (pageSize <= 0) {
        const items = await client.request(
            readItems(collection, {
                fields: handler.indexFields,
                limit: -1,
            }),
        );
        yield* items;
        return;
    }

    // Paged read. Directus pages are 1-based; a short (or empty) page means we've reached the end.
    let page = 1;
    while (true) {
        const batch = await client.request(
            readItems(collection, {
                fields: handler.indexFields,
                limit: pageSize,
                page,
            }),
        );

        yield* batch;

        if (batch.length < pageSize) {
            break;
        }
        page++;
    }
}

/**
 * Eagerly collects every item via {@link streamItems}. Use only when the caller genuinely needs the
 * whole collection in memory at once — e.g. the repair CLI, which diffs the database against the
 * index. Otherwise prefer streamItems() to keep the memory footprint bounded.
 */
export async function collectItems(
    client: any,
    collection: string,
    handler: ItemHandler,
): Promise<any[]> {
    const items: any[] = [];
    for await (const item of streamItems(client, collection, handler)) {
        items.push(item);
    }
    return items;
}
