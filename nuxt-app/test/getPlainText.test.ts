import { describe, expect, it } from 'vitest'
import { getPlainText } from '../helpers/getPlainText'

// This replaced `String.replace(/<[^<>]+>/g, '')` at five call sites whose output was then passed to
// `v-html`. The bypass cases below are the reason the swap happened, so they are the part of this
// suite worth keeping: they fail if anyone reintroduces regex-based tag stripping.

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
        for (const payload of [
            '<img<a> src=x onerror=alert(1)>',
            '<svg<a> onload=alert(1)>',
            '<script>alert(1)</script>',
            '<math><mtext><script>alert(1)</script></mtext></math>',
            '<div onclick=alert(1)>x</div>',
            '<iframe src="https://evil.test"></iframe>',
        ]) {
            expect(getPlainText(payload)).not.toMatch(/<[a-zA-Z]/)
        }
    })

    it('keeps text content when unwrapping elements', () => {
        expect(getPlainText('<div onclick=alert(1)>sichtbar</div>')).toBe('sichtbar')
    })
})
