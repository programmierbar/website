import { AbstractItemHandler } from './ItemHandler.ts';
import { sanitize, sanitizeFull, truncateToByteLimit } from '../util/sanitizer.ts';

// Keep meetup records comfortably below Algolia's per-record size limit. Mirrors the podcast handler:
// once the sanitized text grows past this, we fall back to fully stripped (tag-less) text.
const MAX_TALK_TEXT_LENGTH = 2500;
const MAX_DESCRIPTION_LENGTH = 2500;

// Algolia rejects any record over a hard 10 KB (10000-byte) limit, and a rejected record means the
// meetup vanishes from search entirely. We target this slightly lower ceiling for the payload this
// handler builds, leaving the remaining headroom for the `distinct` and `_directus_reference` fields
// that the rebuild/repair CLIs and the live hook append to every payload after buildAttributes()
// returns (two UUIDs, ~110 bytes). Algolia counts the SERIALIZED record (UTF-8 bytes, including JSON
// escaping), so the fitting logic below measures JSON.stringify() rather than guessing field sizes.
const MAX_PAYLOAD_BYTES = 9700;
// Talks take at most this share of the budget; the description (the snippet shown in search results)
// then gets whatever is left, so a talk-less meetup can still use almost the entire allowance for its
// text rather than being cut short by a fixed, smaller cap.
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

        // Talks get a bounded share of the budget; the description takes whatever is left.
        talks = truncateToByteLimit(talks, MAX_TALK_TEXT_BYTES);

        const payload = {
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
        };

        // Final size guard against Algolia's 10 KB hard limit. We measure the SERIALIZED payload and
        // trim the description (the only remaining unbounded field) until it fits. Measuring the real
        // JSON — rather than budgeting by field length — is what makes this correct in the awkward
        // cases: long titles/slugs (the schema allows 255 chars each) eat into the same budget, and
        // JSON escaping (every `\n` in a conference agenda becomes `\\n`) makes the serialized size
        // larger than the raw byte count.
        this.fitPayloadToByteLimit(payload);

        return [payload];
    }

    // Trims `payload.description` until the serialized payload is within MAX_PAYLOAD_BYTES. Loops
    // because JSON escaping means a raw-byte trim doesn't map 1:1 onto serialized bytes; it converges
    // in one or two passes. `talks` is already bounded, so the description is the only field we cut.
    private fitPayloadToByteLimit(payload: Record<string, any>): void {
        while (
            payload.description.length > 0 &&
            Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES
        ) {
            const overflowBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8') - MAX_PAYLOAD_BYTES;
            const descriptionBytes = Buffer.byteLength(payload.description, 'utf8');
            payload.description = truncateToByteLimit(payload.description, Math.max(0, descriptionBytes - overflowBytes));
        }
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
