import { AbstractItemHandler } from './ItemHandler.ts';
import { sanitize, sanitizeFull, truncateToByteLimit } from '../util/sanitizer.ts';

// Keep meetup records comfortably below Algolia's per-record size limit. Mirrors the podcast handler:
// once the sanitized text grows past this, we fall back to fully stripped (tag-less) text.
const MAX_TALK_TEXT_LENGTH = 2500;
const MAX_DESCRIPTION_LENGTH = 2500;

// Algolia rejects any record over a hard 10 KB (10000-byte) limit, and a rejected record means the
// meetup vanishes from search entirely. These byte budgets keep us safely under that ceiling even
// for a meetup with a long description AND many talks. We give the description first claim on the
// budget (it's what the search result card shows) and let the talk text use whatever remains.
const MAX_RECORD_TEXT_BYTES = 9000;
const MAX_DESCRIPTION_BYTES = 5000;

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

        // Final byte-budget guard. Sanitizing already removes the worst offenders, but a genuinely
        // long meetup (big description + many talks) could still exceed Algolia's 10 KB hard limit, so
        // we cap by UTF-8 byte length. Description gets first claim; talks take whatever's left.
        description = truncateToByteLimit(description, MAX_DESCRIPTION_BYTES);
        const remainingTalkBytes = MAX_RECORD_TEXT_BYTES - Buffer.byteLength(description, 'utf8');
        talks = truncateToByteLimit(talks, Math.max(0, remainingTalkBytes));

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
