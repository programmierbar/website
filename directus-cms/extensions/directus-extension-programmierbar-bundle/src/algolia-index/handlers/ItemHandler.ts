export interface ItemHandler {
    collectionName: string;
    updateRequired(item: any): boolean;
    buildAttributes(item: any): Record<string, any>[];
    requiresDistinctDeletionBeforeUpdate(): boolean;
    buildDistinctKey(item: any): string;
    buildDeletionFilter(item: any): string;
}

export abstract class AbstractItemHandler {
    requiresDistinctDeletionBeforeUpdate(): boolean {
        return false;
    }

    buildDistinctKey(item: any): string {
        return `${item.id}`;
    }
}
