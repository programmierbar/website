import ItemHandler from './ItemHandler.ts'

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
            item.slug ||
            item.description ||
            item.type ||
            item.published_on ||
            item.cover_image
        )
    }

    buildAttributes(item: any): object {
        return {
            title: item.title,
            description: item.description,
            type: item.type,
            published_on: item.published_on,
            image: item.cover_image ? `${this._env.PUBLIC_URL}assets/${item.cover_image}` : undefined,
            url: item.slug ? `${this._env.PUBLIC_URL}podcast/${item.slug}` : undefined,
        }
    }
}
