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
