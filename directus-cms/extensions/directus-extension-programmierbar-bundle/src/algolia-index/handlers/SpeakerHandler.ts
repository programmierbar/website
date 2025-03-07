import { AbstractItemHandler } from './ItemHandler.ts';

export class SpeakerHandler extends AbstractItemHandler {

    get collectionName(): string {
        return 'speakers';
    }

    updateRequired(item: any): boolean {
        return (
            item.first_name ||
            item.last_name ||
            item.academic_title ||
            item.description ||
            item.published_on ||
            item.profile_image ||
            item.slug
        )
    }

    buildAttributes(item: any): Record<string, any>[] {
        return [{
            _type : 'speaker',
            first_name: item.first_name,
            last_name: item.last_name,
            academic_title: item.academic_title,
            description: item.description,
            published_on: item.published_on,
            slug: item.slug,
            image: item.profile_image ? `${this.env.PUBLIC_URL}assets/${item.profile_image}` : undefined,
        }]
    }
}
