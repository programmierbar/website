import { AbstractItemHandler } from './ItemHandler.ts';
import { sanitize, sanitizeFull } from '../util/sanitizer.ts';

// Keep meetup records comfortably below Algolia's per-record size limit. Mirrors the podcast handler:
// once the sanitized talk text grows past this, we fall back to fully stripped (tag-less) text.
const MAX_TALK_TEXT_LENGTH = 2500;

export class MeetupHandler extends AbstractItemHandler{

    get collectionName(): string {
        return 'meetups';
    }

    // Every field read by updateRequired() and buildAttributes(). `status` is added by the hook.
    //
    // NOTE: `intro` is required by buildAttributes() but was historically missing from the CLI field
    // list, so rebuilt meetups silently lost their intro text. It is included here now.
    //
    // Newer meetups carry much of their content in dedicated `talks` (each talk has its own title and
    // abstract) rather than in the meetup-level description, so we read the linked talks' text too.
    // `talks` is the meetup's M2M field via the `meetups_talks` junction, hence the `talks.talk.*`
    // path. Talk text edited directly on the `talks` collection is kept fresh by the hook's
    // `talks.items.update` handler.
    get indexFields(): string[] {
        return [
            'id', 'title', 'slug', 'intro', 'description', 'published_on', 'cover_image',
            'talks.talk.title', 'talks.talk.abstract',
        ];
    }

    updateRequired(item: any): boolean {
        return (
            item.title ||
            item.slug ||
            item.intro ||
            item.description ||
            item.published_on ||
            item.cover_image ||
            // Linking/unlinking a talk changes the meetup's `talks` field; reindex so talk text stays
            // current. (Edits to a talk's own text arrive via the talks.items.update hook instead.)
            item.talks
        )
    }

    buildAttributes(item: any): Record<string, any>[] {
        // Talk text lives in its own searchable `talks` attribute rather than in `description`: the
        // search result card displays `description`, and we don't want to bury the meetup summary
        // under the concatenated talk abstracts. The index defines no explicit searchableAttributes,
        // so every attribute — including this one — is searchable by default.
        let talks = this.buildTalkText(item, sanitize);
        if (talks.length > MAX_TALK_TEXT_LENGTH) {
            talks = this.buildTalkText(item, sanitizeFull);
        }

        return [{
            _type : 'meetup',
            title: item.title,
            description: [item.intro, item.description].filter(Boolean).join(' '),
            talks: talks || undefined,
            published_on: item.published_on,
            image: item.cover_image ? `${this.env.PUBLIC_URL}assets/${item.cover_image}` : undefined,
            slug: item.slug,
        }]
    }

    // Concatenates every linked talk's title + abstract into one searchable string. Each `item.talks`
    // entry is a `meetups_talks` junction row of shape `{ talk: { title, abstract }, ... }`.
    private buildTalkText(item: any, sanitizer: (input: string) => string): string {
        if (!Array.isArray(item.talks)) {
            return '';
        }

        return item.talks
            .map((entry: any) => entry?.talk)
            .filter(Boolean)
            .map((talk: any) => [talk.title, talk.abstract ? sanitizer(talk.abstract) : '']
                .filter(Boolean)
                .join(' ')
                .trim())
            .filter(Boolean)
            .join(' ');
    }
}
