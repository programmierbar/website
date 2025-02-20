export interface ItemHandler {
    collectionName: string;
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
