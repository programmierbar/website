import DOMPurify from 'isomorphic-dompurify'
import { normalizeExternalUrl } from './normalizeExternalUrl'

// The single place that decides how untrusted CMS text is made safe to render. Every `v-html` binding
// and every plain-text excerpt in the app goes through one of these, so a policy change — tightening
// the allowed tags, swapping the sanitiser — happens here rather than in each component.
//
// Deliberately not re-exported from `helpers/index.ts`: that barrel is imported by server routes, and
// pulling isomorphic-dompurify in through it would instantiate jsdom for consumers that only wanted a
// date helper. Import this module directly.

// Editors also leave the scheme off links *inside* rich text, not just in the dedicated URL fields:
// `href="innoq.com/de/staff/stefan-tilkov/"` in a speaker biography resolves against the current page
// and 404s on our own domain, and the prerender crawler follows it and fails the build.
//
// This runs in `afterSanitizeAttributes`, so DOMPurify has already removed anything unsafe — a
// `javascript:` href is gone before this sees the node, and only values it approved are rewritten.
// Root-relative links are left alone, so internal links in rich text keep working.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (typeof (node as Element).getAttribute !== 'function') {
        return
    }

    const element = node as Element

    for (const attribute of ['href', 'src']) {
        const value = element.getAttribute(attribute)

        if (!value) {
            continue
        }

        const normalized = normalizeExternalUrl(value)

        if (normalized === undefined) {
            // Not usable as a URL at all — better a non-clickable link than one that navigates into
            // our own site and 404s.
            element.removeAttribute(attribute)
        } else if (normalized !== value) {
            element.setAttribute(attribute, normalized)
        }
    }
})

/**
 * Sanitises CMS rich text for rendering as HTML.
 *
 * Use this for anything bound to `v-html`. Keeps the markup editors legitimately produce — headings,
 * emphasis, links, styled spans — and removes scripts, event handlers and unsafe URLs.
 */
export function sanitizeHtml(html: string | null | undefined): string {
    if (!html) {
        return ''
    }

    return DOMPurify.sanitize(html)
}

/**
 * Like {@link sanitizeHtml}, but for text rendered inline, where a block element would break the
 * layout. Used by the news ticker, whose items sit inside a single scrolling line.
 */
export function sanitizeInlineHtml(html: string | null | undefined): string {
    if (!html) {
        return ''
    }

    return DOMPurify.sanitize(html, { FORBID_TAGS: ['p'] })
}

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
