import sanitizeHtml from 'sanitize-html'

const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

/** Escape plain text for use in HTML/MJML content and in double-quoted attributes. */
export function escapeHtml(value: string | null | undefined): string {
    return (value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}

/**
 * Sanitize rich-text HTML from the Directus WYSIWYG editor before it goes into a mail.
 *
 * The allowlist mirrors the editor toolbar of `newsletter_blocks_text.body` (bold, italic,
 * lists, blockquote, link, code). Everything else — scripts, styles, event handlers, MJML
 * tags that could break out of the surrounding `<mj-text>` — is dropped.
 */
export function sanitizeRichText(html: string | null | undefined): string {
    return sanitizeHtml(html ?? '', {
        allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre'],
        allowedAttributes: {
            a: ['href', 'title', 'target', 'rel'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowProtocolRelative: false,
    })
}

/** Join a base URL and a path without doubling or dropping the slash. */
export function joinUrl(baseUrl: string, path: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
