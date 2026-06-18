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
