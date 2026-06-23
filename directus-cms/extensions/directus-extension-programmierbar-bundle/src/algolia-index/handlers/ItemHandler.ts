export interface ItemHandler {
    collectionName: string;
    /**
     * The Directus fields required to build this handler's index entries — the single source of
     * truth shared by the live hook (which re-reads the full item) and the rebuild/repair CLIs
     * (which fetch items in bulk). MUST list every field that `updateRequired` and `buildAttributes`
     * read, including relational fields with their nested paths (e.g. `podcast.*`). If a field is
     * missing here it will silently be absent from the index.
     */
    indexFields: string[];
    /**
     * Page size for the rebuild/repair CLIs' bulk reads from Directus. Most collections are small
     * enough (in both row count AND per-row size) to fetch in a single `limit: -1` request, so the
     * default (see {@link AbstractItemHandler}) returns `<= 0`, meaning "no pagination".
     *
     * Override with a small positive number for collections whose rows are individually large — e.g.
     * transcripts, which embed a full hour of audio transcription per row. There a single bulk read
     * overruns Directus (and would pin hundreds of MB in memory), so they must be paged through.
     */
    pageSize: number;
    updateRequired(item: any): boolean;
    buildAttributes(item: any): Record<string, any>[];
    requiresDistinctDeletionBeforeUpdate(): boolean;
    buildDistinctKey(item: any): string;
    buildDeletionFilter(item: any): string;
    buildDirectusReference(item: any): string;
}

export abstract class AbstractItemHandler {

    constructor(protected env, private logger) {
    }

    // No pagination by default: the whole collection is fetched in one request. Handlers with large
    // rows (e.g. transcripts) override this with a small positive page size. See ItemHandler.pageSize.
    get pageSize(): number {
        return -1;
    }

    requiresDistinctDeletionBeforeUpdate(): boolean {
        return false;
    }

    buildDistinctKey(item: any): string {
        return `${item.id}`;
    }

    buildDirectusReference(item: any): string {
        return `${item.id}`;
    }

    buildDeletionFilter(item: any): string {
        return `_directus_reference:${this.buildDirectusReference(item)}`;
    }
}
