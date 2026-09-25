// Named entities that the CMS's rich-text editor writes. Anything not listed here is left as it is,
// which is visible but harmless, rather than guessed at.
const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    shy: '',
    auml: 'ä',
    ouml: 'ö',
    uuml: 'ü',
    Auml: 'Ä',
    Ouml: 'Ö',
    Uuml: 'Ü',
    szlig: 'ß',
    aacute: 'á',
    agrave: 'à',
    acirc: 'â',
    eacute: 'é',
    egrave: 'è',
    ecirc: 'ê',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    ccedil: 'ç',
    ntilde: 'ñ',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    bdquo: '„',
    ldquo: '“',
    rdquo: '”',
    sbquo: '‚',
    lsquo: '‘',
    rsquo: '’',
    laquo: '«',
    raquo: '»',
    middot: '·',
    bull: '•',
    euro: '€',
    copy: '©',
    reg: '®',
    trade: '™',
    deg: '°',
    times: '×',
    rarr: '→',
    larr: '←',
}

// Elements that separate text visually. Removing them without leaving a space glues the last word of
// one paragraph to the first word of the next.
const BLOCK_TAG_REGEX =
    /<\/?(?:address|article|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|ol|p|pre|section|table|td|th|tr|ul)\b[^>]*>/gi

/**
 * Decodes named and numeric HTML character references.
 *
 * @param text The text containing character references.
 *
 * @returns The decoded text.
 */
function decodeHtmlEntities(text: string) {
    return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (reference, name: string) => {
        if (name.startsWith('#')) {
            const codePoint = name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
            return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference
        }
        return NAMED_ENTITIES[name] ?? reference
    })
}

/**
 * A helper function that converts rich text from the CMS into a single line of plain text, e.g. for
 * meta descriptions.
 *
 * @param html The rich text, or plain text.
 *
 * @returns The plain text.
 */
export function getPlainText(html: string) {
    const withoutTags = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(BLOCK_TAG_REGEX, ' ')
        .replace(/<[^<>]+>/g, '')

    // Decode only after removing the tags, so encoded markup such as `&lt;div&gt;` stays text
    return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim()
}
