import DOMPurify from 'isomorphic-dompurify'

// Deliberately not re-exported from `helpers/index.ts`: that barrel is imported by server routes, and
// pulling isomorphic-dompurify in through it would instantiate jsdom for consumers that only wanted a
// date helper. Import this module directly.

/**
 * Reduces CMS rich text to plain text.
 *
 * For card excerpts and search results, which want a snippet of prose rather than markup. Returns
 * real text, not an HTML string — every entity is decoded (`f&uuml;r` becomes `für`, `&amp;` becomes
 * `&`), so the result is safe to render with `{{ }}` and must not be passed to `v-html`.
 *
 * Parses rather than pattern-matches on purpose. Stripping tags with a regex such as
 * `/<[^<>]+>/g` cannot match a tag that contains `<` or `>`, so `<img<a> src=x onerror=alert(1)>`
 * survives it as a working tag.
 */
export function getPlainText(html: string | null | undefined): string {
    if (!html) {
        return ''
    }

    const fragment = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        RETURN_DOM_FRAGMENT: true,
    })

    return fragment.textContent ?? ''
}
