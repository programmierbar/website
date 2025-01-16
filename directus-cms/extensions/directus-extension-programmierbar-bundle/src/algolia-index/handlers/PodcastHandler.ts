import { ItemHandler } from './ItemHandler.ts'
import { sanitize, sanitizeFull } from '../util/sanitizer.ts';

export class PodcastHandler implements ItemHandler {

    private _env: any;
    private _logger: any;

    constructor(env, logger) {
        this._env = env;
        this._logger = logger;
    }

    get collectionName(): string {
        return 'podcasts';
    }

    updateRequired(item: any): boolean {
        return (
            item.title ||
            item.number ||
            item.slug ||
            item.description ||
            item.type ||
            item.published_on ||
            item.cover_image
        )
    }

    buildAttributes(item: any): Record<string, any> {

        // This is a simple workaround for the algolia size-limit per index-entry
        // Ideally, we would split this out into multiple index entries later
        let description = sanitize(item.description);
        if (description.length > 2500) {
            description = sanitizeFull(item.description);
        }

        return {
            _type : 'podcast',
            title: item.title,
            number: item.number,
            description: description,
            type: item.type,
            published_on: item.published_on,
            image: item.cover_image ? `${this._env.PUBLIC_URL}assets/${item.cover_image}` : undefined,
            slug: item.slug,
        }
    }
}
