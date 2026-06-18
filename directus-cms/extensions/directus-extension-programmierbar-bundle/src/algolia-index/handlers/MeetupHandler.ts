import { AbstractItemHandler } from './ItemHandler.ts';

export class MeetupHandler extends AbstractItemHandler{

    get collectionName(): string {
        return 'meetups';
    }

    // Every field read by updateRequired() and buildAttributes(). `status` is added by the hook.
    // NOTE: `intro` is required by buildAttributes() but was historically missing from the CLI field
    // list, so rebuilt meetups silently lost their intro text. It is included here now.
    get indexFields(): string[] {
        return ['id', 'title', 'slug', 'intro', 'description', 'published_on', 'cover_image'];
    }

    updateRequired(item: any): boolean {
        return (
            item.title ||
            item.slug ||
            item.intro ||
            item.description ||
            item.published_on ||
            item.cover_image
        )
    }

    buildAttributes(item: any): Record<string, any>[] {
        return [{
            _type : 'meetup',
            title: item.title,
            description: [item.intro, item.description].filter(Boolean).join(' '),
            published_on: item.published_on,
            image: item.cover_image ? `${this.env.PUBLIC_URL}assets/${item.cover_image}` : undefined,
            slug: item.slug,
        }]
    }
}
