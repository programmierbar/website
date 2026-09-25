import { describe, expect, it } from 'vitest'
import { getPlainText, sanitizeHtml, sanitizeInlineHtml } from '../helpers/sanitize'

// This module is the single place that decides how untrusted CMS text becomes safe to render, so the
// policy itself is worth pinning down rather than only its callers.
//
// `getPlainText` replaced `String.replace(/<[^<>]+>/g, '')` at five call sites whose output was then
// passed to `v-html`. The bypass cases are the reason the swap happened: they fail if anyone
// reintroduces regex-based tag stripping.

const XSS_PAYLOADS = [
    '<img<a> src=x onerror=alert(1)>',
    '<svg<a> onload=alert(1)>',
    '<script>alert(1)</script>',
    '<math><mtext><script>alert(1)</script></mtext></math>',
    '<iframe src="https://evil.test"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
]

// Inspect tags, not the whole string. A sanitised payload often leaves its remains as inert text —
// `<img<a> src=x onerror=alert(1)>` reduces to the literal text ` src=x onerror=alert(1)&gt;`, where
// `onerror=` is content rather than an attribute and cannot execute. Searching the raw string for
// "onerror" would flag that as dangerous when it is not.
const dangerousTagsIn = (html: string): string[] =>
    (html.match(/<[a-zA-Z][^>]*>/g) ?? []).filter(
        (tag) =>
            /^<(script|iframe|object|embed|style)\b/i.test(tag) ||
            /\son\w+\s*=/i.test(tag) ||
            /(href|src|action)\s*=\s*["']?\s*(javascript|vbscript|data):/i.test(tag)
    )

describe('the danger check used below', () => {
    it('flags unsanitised payloads, so the assertions are not vacuous', () => {
        expect(dangerousTagsIn('<img src=x onerror=alert(1)>')).toHaveLength(1)
        expect(dangerousTagsIn('<script>alert(1)</script>')).toHaveLength(1)
        expect(dangerousTagsIn('<a href="javascript:alert(1)">x</a>')).toHaveLength(1)
        expect(dangerousTagsIn('<p>harmless <strong>text</strong></p>')).toHaveLength(0)
    })
})

describe('sanitizeHtml', () => {
    it('keeps the markup CMS editors legitimately produce', () => {
        // Including the styled span that carries the brand colour in `profile_creation_page`.
        const rich = '<p>Willkommen bei der <strong>programmier.<span style="color: #cfff00;">bar</span></strong></p>'
        expect(sanitizeHtml(rich)).toBe(rich)
        expect(sanitizeHtml('<h2>Titel</h2><ul><li>eins</li></ul>')).toBe('<h2>Titel</h2><ul><li>eins</li></ul>')
        expect(sanitizeHtml('<a href="/x">Link</a>')).toBe('<a href="/x">Link</a>')
    })

    it('removes scripts, event handlers and unsafe URLs', () => {
        for (const payload of XSS_PAYLOADS) {
            expect(dangerousTagsIn(sanitizeHtml(payload))).toEqual([])
        }
    })

    it('handles absent input', () => {
        expect(sanitizeHtml('')).toBe('')
        expect(sanitizeHtml(null)).toBe('')
        expect(sanitizeHtml(undefined)).toBe('')
    })
})

describe('sanitizeInlineHtml', () => {
    it('drops paragraphs but keeps their text, so the ticker stays on one line', () => {
        expect(sanitizeInlineHtml('<p>Neue Folgen dienstags</p>')).toBe('Neue Folgen dienstags')
        expect(sanitizeInlineHtml('<p>eins</p><p>zwei</p>')).toBe('einszwei')
    })

    it('still allows inline markup', () => {
        expect(sanitizeInlineHtml('<strong>wichtig</strong>')).toBe('<strong>wichtig</strong>')
    })

    it('removes the same attacks as the default policy', () => {
        for (const payload of XSS_PAYLOADS) {
            expect(dangerousTagsIn(sanitizeInlineHtml(payload))).toEqual([])
        }
    })
})

describe('getPlainText', () => {
    it('returns empty string for empty input', () => {
        expect(getPlainText('')).toBe('')
        expect(getPlainText(null)).toBe('')
        expect(getPlainText(undefined)).toBe('')
    })

    it('strips the markup Directus WYSIWYG fields actually contain', () => {
        expect(getPlainText('<p>Ein <strong>Text</strong> mit <a href="/x">Link</a></p>')).toBe('Ein Text mit Link')
        expect(getPlainText('<h2>Überschrift</h2>')).toBe('Überschrift')
        expect(getPlainText('Kein Markup')).toBe('Kein Markup')
    })

    it('decodes HTML entities, so German text is not garbled', () => {
        // The regex this replaced left these encoded. That was invisible while the value went to
        // `v-html` (the browser decoded them) and would have surfaced the moment it moved to `{{ }}`.
        expect(getPlainText('<p>f&uuml;r Bauk&auml;sten</p>')).toBe('für Baukästen')
        expect(getPlainText('<p>&quot;Moin&quot;</p>')).toBe('"Moin"')
        expect(getPlainText('<p>begr&uuml;&szlig;en</p>')).toBe('begrüßen')
        expect(getPlainText('<h2>Web &amp; AI Edition 2025</h2>')).toBe('Web & AI Edition 2025')
    })

    it('yields inert text for payloads that defeat regex tag-stripping', () => {
        // `/<[^<>]+>/g` cannot match a tag containing `<` or `>`, so removing the inner tag
        // reassembled a working one: `<img<a> src=x onerror=alert(1)>` became
        // `<img src=x onerror=alert(1)>` and executed once handed to `v-html`.
        for (const payload of [...XSS_PAYLOADS, '<div onclick=alert(1)>x</div>']) {
            expect(getPlainText(payload)).not.toMatch(/<[a-zA-Z]/)
        }
    })

    it('keeps text content when unwrapping elements', () => {
        expect(getPlainText('<div onclick=alert(1)>sichtbar</div>')).toBe('sichtbar')
    })

    it('keeps paragraphs, list items and line breaks apart', () => {
        expect(getPlainText('<p>Das war verheerend.</p><p>PS: Danke!</p>')).toBe('Das war verheerend. PS: Danke!')
        expect(getPlainText('Zeile eins<br>Zeile zwei<br/>Zeile drei')).toBe('Zeile eins Zeile zwei Zeile drei')
        expect(getPlainText('<ul><li>Eins</li><li>Zwei</li></ul>')).toBe('Eins Zwei')
    })

    it('does not add spaces around inline elements', () => {
        expect(getPlainText('<p>Ein <a href="/x">Link</a>, <strong>fett</strong>.</p>')).toBe('Ein Link, fett.')
    })

    it('collapses whitespace, including non-breaking spaces, into a single line', () => {
        expect(getPlainText('\n<p>Zum Schluss&nbsp;<a>Googlebook</a></p>\n\n<p>  Ende </p>')).toBe(
            'Zum Schluss Googlebook Ende'
        )
    })

    it('keeps angle brackets that are not markup', () => {
        expect(getPlainText('2 < 3 and 4 > 1')).toBe('2 < 3 and 4 > 1')
        expect(getPlainText('<p>a <b>&lt;</b> b</p><p>c > d</p>')).toBe('a < b c > d')
    })

    it('decodes only once, so encoded markup stays text', () => {
        expect(getPlainText('&amp;uuml;')).toBe('&uuml;')
        expect(getPlainText('&lt;p&gt;kein Absatz&lt;/p&gt;')).toBe('<p>kein Absatz</p>')
    })
})

describe('links inside rich text', () => {
    it('absolutises a schemeless href, which would otherwise 404 on our own domain', () => {
        // Real CMS value, in speaker stefan-tilkov's biography. As `href="innoq.com/..."` a browser
        // resolves it against the current page: /hall-of-fame/innoq.com/de/staff/stefan-tilkov/.
        expect(sanitizeHtml('<p><a href="innoq.com/de/staff/stefan-tilkov/">Profil</a></p>')).toBe(
            '<p><a href="https://innoq.com/de/staff/stefan-tilkov/">Profil</a></p>'
        )
    })

    it('leaves absolute and root-relative links alone', () => {
        expect(sanitizeHtml('<a href="https://example.com/x">x</a>')).toBe('<a href="https://example.com/x">x</a>')
        expect(sanitizeHtml('<a href="/podcast/folge">intern</a>')).toBe('<a href="/podcast/folge">intern</a>')
        expect(sanitizeHtml('<a href="mailto:hallo@programmier.bar">mail</a>')).toBe(
            '<a href="mailto:hallo@programmier.bar">mail</a>'
        )
    })

    it('drops an href that cannot be a URL rather than leaving it relative', () => {
        expect(sanitizeHtml('<a href="justausername">x</a>')).toBe('<a>x</a>')
    })

    it('still removes unsafe URLs — the hook must not reintroduce them', () => {
        for (const payload of [
            '<a href="javascript:alert(1)">x</a>',
            '<a href="JaVaScRiPt:alert(1)">x</a>',
            '<a href=" javascript:alert(1)">x</a>',
        ]) {
            expect(dangerousTagsIn(sanitizeHtml(payload))).toEqual([])
            expect(sanitizeHtml(payload)).not.toMatch(/javascript:/i)
        }
    })

    it('leaves an inline data: image alone, deferring to DOMPurify on existing schemes', () => {
        // The hook only fills in a missing scheme. DOMPurify permits `data:` images, and vetting
        // schemes here as well would strip them.
        const dataUri =
            '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+AV0AAAAASUVORK5CYII=">'
        expect(sanitizeHtml(dataUri)).toContain('data:image/png;base64,')
    })

    it('normalises src as well as href', () => {
        expect(sanitizeHtml('<img src="example.com/a.png">')).toBe('<img src="https://example.com/a.png">')
    })
})
