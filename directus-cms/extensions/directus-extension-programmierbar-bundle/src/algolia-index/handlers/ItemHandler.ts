export interface ItemHandler {
    collectionName: string;
    updateRequired(item: any): boolean;
    buildAttributes(item: any): Record<string, any>;
}
