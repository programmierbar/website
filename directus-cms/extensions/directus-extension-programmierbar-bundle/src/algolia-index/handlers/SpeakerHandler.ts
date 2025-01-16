import { ItemHandler } from './ItemHandler.ts'

export class SpeakerHandler implements ItemHandler {

    private _env: any;
    private _logger: any;

    constructor(env, logger) {
        this._env = env;
        this._logger = logger;
    }

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

    buildAttributes(item: any): Record<string, any> {
        return {
            _type : 'speaker',
            first_name: item.first_name,
            last_name: item.last_name,
            academic_title: item.academic_title,
            description: item.description,
            published_on: item.published_on,
            slug: item.slug,
            image: item.profile_image ? `${this._env.PUBLIC_URL}assets/${item.profile_image}` : undefined,
        }
    }
}
