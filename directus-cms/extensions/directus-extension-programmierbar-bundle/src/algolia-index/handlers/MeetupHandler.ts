import { AbstractItemHandler } from './ItemHandler.ts';
import { sanitize, sanitizeFull, truncateToByteLimit } from '../util/sanitizer.ts';

// Keep meetup records comfortably below Algolia's per-record size limit. Mirrors the podcast handler:
// once the sanitized text grows past this, we fall back to fully stripped (tag-less) text.
const MAX_TALK_TEXT_LENGTH = 2500;
const MAX_DESCRIPTION_LENGTH = 2500;

// Algolia rejects any record over a hard 10 KB (10000-byte) limit, and a rejected record means the
// meetup vanishes from search entirely. This is the combined byte budget for the two free-text
// fields (description + talks); the remaining ~1 KB is headroom for the small fixed fields (title,
// slug, image URL, ids, JSON overhead). Some real meetups — e.g. conference-style ones whose whole
// agenda sits in the description — exceed the limit on their own, so we hard-cap the text by BYTE
// length (Algolia counts UTF-8 bytes; German umlauts/emoji cost 2–4 each).
const MAX_RECORD_TEXT_BYTES = 9000;
// Talks take at most this share of the budget; the description (the snippet shown in search results)
// gets whatever is left, so a talk-less meetup can still use almost the entire allowance for its text
// rather than being cut short by a fixed, smaller cap.
const MAX_TALK_TEXT_BYTES = 4000;

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
        // The description (intro + description) MUST be sanitized: these are rich-text fields and are
        // sometimes pasted in from other tools (e.g. Slack), carrying kilobytes of `<div class=...>`
        // markup that both pollutes search and blows past Algolia's record-size limit. We strip it the
        // same way the podcast handler does — sanitize() keeps a little structure, sanitizeFull()
        // removes everything — falling back to the harder strip once the text gets long.
        let description = this.buildDescription(item, sanitize);
        if (description.length > MAX_DESCRIPTION_LENGTH) {
            description = this.buildDescription(item, sanitizeFull);
        }

        // Talk text lives in its own searchable `talks` attribute rather than in `description`: the
        // search result card displays `description`, and we don't want to bury the meetup summary
        // under the concatenated talk abstracts. The index defines no explicit searchableAttributes,
        // so every attribute — including this one — is searchable by default.
        let talks = this.buildTalkText(item, sanitize);
        if (talks.length > MAX_TALK_TEXT_LENGTH) {
            talks = this.buildTalkText(item, sanitizeFull);
        }

        // Final byte-budget guard. Sanitizing removes the worst offenders, but a long meetup (or one
        // whose whole agenda lives in the description) can still blow past Algolia's 10 KB hard limit,
        // so we cap the two text fields by UTF-8 byte length to keep them under MAX_RECORD_TEXT_BYTES.
        // Talks get a bounded share; the description (the snippet shown in search) then takes whatever
        // of the budget is left, so it's only ever cut at the longest length that still fits.
        talks = truncateToByteLimit(talks, MAX_TALK_TEXT_BYTES);
        const remainingDescriptionBytes = MAX_RECORD_TEXT_BYTES - Buffer.byteLength(talks, 'utf8');
        description = truncateToByteLimit(description, Math.max(0, remainingDescriptionBytes));

        return [{
            _type : 'meetup',
            title: item.title,
            // Always send a string (empty when there's no content), never `undefined`. The hook and
            // rebuild push via partialUpdateObject, which drops `undefined` properties from the
            // request — so an `undefined` here would leave a now-empty field showing its previous
            // (possibly stale raw-HTML) value in the index instead of clearing it. An empty string
            // explicitly overwrites it.
            description: description,
            talks: talks,
            published_on: item.published_on,
            image: item.cover_image ? `${this.env.PUBLIC_URL}assets/${item.cover_image}` : undefined,
            slug: item.slug,
        }]
    }

    // Joins the meetup's intro and description into a single sanitized snippet. Both are rich-text
    // fields, so each is run through the supplied sanitizer before being combined.
    private buildDescription(item: any, sanitizer: (input: string) => string): string {
        return [item.intro, item.description]
            .filter(Boolean)
            .map((text: string) => sanitizer(text).trim())
            .filter(Boolean)
            .join(' ');
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
