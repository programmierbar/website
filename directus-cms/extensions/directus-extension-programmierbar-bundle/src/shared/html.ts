/**
 * Helpers for the rich-text HTML the Directus editor stores, shared by every
 * extension that turns it into something else (Discord embeds, plain-text mail).
 */

/**
 * Named HTML entities the rich-text editor emits. German umlauts are
 * case-sensitive (`&auml;` = ä, `&Auml;` = Ä), so both cases are listed
 * explicitly rather than folded.
 */
const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    auml: 'ä',
    ouml: 'ö',
    uuml: 'ü',
    Auml: 'Ä',
    Ouml: 'Ö',
    Uuml: 'Ü',
    szlig: 'ß',
    euro: '€',
    hellip: '…',
    ndash: '–',
    mdash: '—',
    bdquo: '„',
    ldquo: '“',
    rdquo: '”',
    sbquo: '‚',
    lsquo: '‘',
    rsquo: '’',
}

/**
 * Decode the HTML entities the rich-text editor emits — named (incl. German
 * umlauts), decimal (`&#228;`) and hex (`&#xE4;`). Runs as a single left-to-right
 * pass so a literal `&amp;lt;` decodes to the text `&lt;` rather than `<`.
 */
export function decodeEntities(value: string): string {
    return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
        if (entity[0] === '#') {
            const code =
                entity[1] === 'x' || entity[1] === 'X'
                    ? Number.parseInt(entity.slice(2), 16)
                    : Number.parseInt(entity.slice(1), 10)

            if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
                return String.fromCodePoint(code)
            }

            return match
        }
        // Unknown named entities are left untouched rather than dropped.
        return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, entity) ? NAMED_ENTITIES[entity] : match
    })
}

/** Strip every remaining HTML tag from a string. */
export function stripTags(value: string): string {
    return value.replace(/<[^>]+>/g, '')
}

/** Escape text for use in HTML content and attribute values. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/**
 * Convert editor rich text into plain text: list items become bullet lines,
 * block-level tags become blank lines, every other tag is dropped. Links are
 * rendered by `formatLink` (e.g. Markdown for Discord, "text (url)" for mail);
 * it gets the link's visible text, which may be empty.
 */
export function htmlToText(html: string, formatLink: (href: string, text: string) => string): string {
    if (!html) {
        return ''
    }

    const withBreaks = html
        .replace(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, label: string) =>
            formatLink(href, stripTags(label).trim())
        )
        // `<li>` opens its own bullet line; its closing tag is dropped below so
        // it does not add a second break between items.
        .replace(/<li\b[^>]*>/gi, '\n- ')
        .replace(/<br\s*\/?>/gi, '\n')
        // Block-level closings become a blank line so paragraphs stay separated.
        .replace(/<\/(p|div|ul|ol|h[1-6]|blockquote)>/gi, '\n\n')

    return decodeEntities(stripTags(withBreaks))
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
