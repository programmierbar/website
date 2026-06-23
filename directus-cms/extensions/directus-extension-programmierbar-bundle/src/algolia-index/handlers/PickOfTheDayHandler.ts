import { AbstractItemHandler } from './ItemHandler.ts';

export class PickOfTheDayHandler extends AbstractItemHandler {

    get collectionName(): string {
        return 'picks_of_the_day';
    }

    // Every field read by updateRequired() and buildAttributes(). `status` is added by the hook.
    get indexFields(): string[] {
        return ['id', 'name', 'website_url', 'description', 'published_on', 'image'];
    }

    updateRequired(item: any): boolean {
        return (
            item.name ||
            item.description ||
            item.website_url ||
            item.published_on ||
            item.image
        )
    }

    buildAttributes(item: any): Record<string, any>[] {
        return [{
            _type : 'pick_of_the_day',
            name: item.name,
            description: item.description,
            website_url: item.website_url,
            published_on: item.published_on,
            image: item.image ? `${this.env.PUBLIC_URL}assets/${item.image}` : undefined,
        }]
    }
}
