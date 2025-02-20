import { AbstractItemHandler, ItemHandler } from './ItemHandler.ts';

export class PickOfTheDayHandler extends AbstractItemHandler {

    get collectionName(): string {
        return 'picks_of_the_day';
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
