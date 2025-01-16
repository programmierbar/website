import { ItemHandler } from './ItemHandler.ts'

export class MeetupHandler implements ItemHandler {

    private _env: any;
    private _logger: any;

    constructor(env, logger) {
        this._env = env;
        this._logger = logger;
    }

    get collectionName(): string {
        return 'meetups';
    }

    updateRequired(item: any): boolean {
        return (
            item.title ||
            item.slug ||
            item.description ||
            item.published_on ||
            item.cover_image
        )
    }

    buildAttributes(item: any): Record<string, any> {
        return {
            _type : 'meetup',
            title: item.title,
            description: item.description,
            published_on: item.published_on,
            image: item.cover_image ? `${this._env.PUBLIC_URL}assets/${item.cover_image}` : undefined,
            slug: item.slug,
        }
    }
}
