import sanitizeHtml from 'sanitize-html';

export function sanitize(input: string): string {
    return sanitizeHtml(input, {
        allowedTags: [ 'a', 'p', 'ul', 'li' ],
        allowedAttributes: {
            'a': [ 'href' ]
        }
    });
}

export function sanitizeFull(input: string): string {
    return sanitizeHtml(input, {
        allowedTags: [ ],
        allowedAttributes: { }
    });
}

// Hard-trims a string so its UTF-8 byte length never exceeds `maxBytes`. Algolia measures records in
// BYTES (not characters) and rejects any record over its hard 10 KB limit outright — a rejected
// record means the item silently disappears from search. We measure bytes (not `.length`) because
// umlauts/emoji in German meetup text cost 2–4 bytes each, so a character cap would under-count.
// Trims on a word boundary where one is reasonably close, to avoid cutting mid-word.
export function truncateToByteLimit(input: string, maxBytes: number): string {
    if (Buffer.byteLength(input, 'utf8') <= maxBytes) {
        return input;
    }

    // Converge from the overshoot: each pass drops roughly the number of surplus bytes, so we reach
    // the budget in a handful of iterations regardless of how multi-byte the text is.
    let truncated = input;
    while (Buffer.byteLength(truncated, 'utf8') > maxBytes && truncated.length > 0) {
        const overshootBytes = Buffer.byteLength(truncated, 'utf8') - maxBytes;
        const charsToDrop = Math.max(1, Math.ceil(overshootBytes / 2));
        truncated = truncated.slice(0, truncated.length - charsToDrop);
    }

    // Prefer ending at the last word boundary, but only if we don't throw away too much.
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > truncated.length * 0.8) {
        truncated = truncated.slice(0, lastSpace);
    }

    return truncated.trimEnd();
}
