import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, markdownToHtml } from '../server/utils/speakerBio'

// The speaker portal edits the rich-text bio as Markdown. Prefill and submit both depend on these
// two functions, and the bio is rendered on public pages, so both directions and the sanitising are
// pinned down here.

describe('htmlToMarkdown', () => {
    it('returns an empty string for empty input', () => {
        expect(htmlToMarkdown(null)).toBe('')
        expect(htmlToMarkdown(undefined)).toBe('')
        expect(htmlToMarkdown('')).toBe('')
        expect(htmlToMarkdown('  \n ')).toBe('')
    })

    it('keeps emphasis and links', () => {
        expect(
            htmlToMarkdown(
                '<p>Erika ist <strong>CTO</strong> bei <em>Beispiel</em> (<a href="https://example.com">Blog</a>).</p>'
            )
        ).toBe('Erika ist **CTO** bei _Beispiel_ ([Blog](https://example.com)).')
    })

    it('separates paragraphs with a blank line and turns <br> into a newline', () => {
        expect(htmlToMarkdown('<p>Erster Absatz.</p>\n<p>Zweiter<br>Absatz.</p>')).toBe(
            'Erster Absatz.\n\nZweiter\nAbsatz.'
        )
    })

    it('writes lists with "- " and indents nested lists under their item', () => {
        expect(
            htmlToMarkdown('<ul><li>Backend<ul><li>TypeScript</li><li>Go</li></ul></li><li>Frontend</li></ul>')
        ).toBe('- Backend\n  - TypeScript\n  - Go\n- Frontend')
        expect(htmlToMarkdown('<ol><li>Eins</li><li>Zwei<ol><li>Unterpunkt</li></ol></li></ol>')).toBe(
            '1. Eins\n2. Zwei\n   1. Unterpunkt'
        )
    })

    it('keeps the text of nested blocks apart', () => {
        // The case the earlier hand-written conversion got wrong: "IntroDetails".
        expect(htmlToMarkdown('<div>Intro<div>Details</div></div>')).toBe('Intro\n\nDetails')
        expect(htmlToMarkdown('<div><p>Eins</p><div>Zwei<p>Drei</p></div></div>')).toBe('Eins\n\nZwei\n\nDrei')
    })

    it('decodes entities', () => {
        expect(htmlToMarkdown('<p>f&uuml;r Br&uuml;cken &amp; T&uuml;ren&nbsp;&lt;3</p>')).toBe(
            'für Brücken & Türen <3'
        )
    })

    it('passes plain text without tags through unchanged', () => {
        expect(htmlToMarkdown('Erika arbeitet bei *Beispiel*.\r\nZweite Zeile')).toBe(
            'Erika arbeitet bei *Beispiel*.\nZweite Zeile'
        )
    })
})

describe('markdownToHtml', () => {
    it('returns an empty string for empty input', () => {
        expect(markdownToHtml(null)).toBe('')
        expect(markdownToHtml(undefined)).toBe('')
        expect(markdownToHtml('')).toBe('')
        expect(markdownToHtml(' \n ')).toBe('')
    })

    it('turns blank lines into paragraphs and single newlines into <br>', () => {
        expect(markdownToHtml('Erste Zeile\nzweite Zeile\n\nNeuer Absatz')).toBe(
            '<p>Erste Zeile<br>zweite Zeile</p>\n<p>Neuer Absatz</p>'
        )
    })

    it('renders emphasis, inline code and links', () => {
        expect(markdownToHtml('**fett**, _kursiv_, `code` und [Blog](https://example.com)')).toBe(
            '<p><strong>fett</strong>, <em>kursiv</em>, <code>code</code> und <a href="https://example.com">Blog</a></p>'
        )
    })

    it('adds the missing scheme to links and keeps mailto', () => {
        expect(markdownToHtml('[Blog](example.com/blog) [Mail](mailto:erika@example.com)')).toBe(
            '<p><a href="https://example.com/blog">Blog</a> <a href="mailto:erika@example.com">Mail</a></p>'
        )
    })

    it('renders nested lists', () => {
        expect(markdownToHtml('- Backend\n  - TypeScript\n- Frontend')).toBe(
            '<ul>\n<li>Backend<ul>\n<li>TypeScript</li>\n</ul>\n</li>\n<li>Frontend</li>\n</ul>'
        )
    })

    it('keeps text with special characters as text', () => {
        expect(markdownToHtml('Tom & Jerry <3')).toBe('<p>Tom &amp; Jerry &lt;3</p>')
    })

    it('turns headings into emphasised paragraphs', () => {
        expect(markdownToHtml('### Werdegang\nText')).toBe('<p><strong>Werdegang</strong></p>\n<p>Text</p>')
    })

    describe('removes everything outside the allowlist', () => {
        it('drops scripts with their content', () => {
            expect(markdownToHtml('Hallo <script>alert(1)</script>')).toBe('<p>Hallo </p>')
            expect(markdownToHtml('<script>alert(1)</script>\n\nHallo')).toBe('<p>Hallo</p>')
        })

        it('drops images and event handlers', () => {
            expect(markdownToHtml('Bild <img src=x onerror=alert(1)>')).toBe('<p>Bild </p>')
            expect(markdownToHtml('![x](https://example.com/a.png)')).toBe('<p></p>')
            expect(markdownToHtml('<b onclick="alert(1)">fett</b>')).toBe('<p><b>fett</b></p>')
        })

        it('drops iframes', () => {
            expect(markdownToHtml('<iframe src="https://example.com"></iframe>\n\nText')).toBe('<p>Text</p>')
        })

        it('keeps only http(s) and mailto links', () => {
            expect(markdownToHtml('[x](javascript:alert(1))')).toBe('<p>x</p>')
            expect(markdownToHtml('[x](data:text/html,hi) [y](/intern)')).toBe('<p>x y</p>')
            expect(markdownToHtml('<a href="javascript:alert(1)">x</a>')).toBe('<p><a>x</a></p>')
        })

        it('drops attributes other than href', () => {
            expect(markdownToHtml('<a href="https://example.com" style="color:red" target="_blank">x</a>')).toBe(
                '<p><a href="https://example.com">x</a></p>'
            )
        })
    })

    it('round-trips CMS rich text', () => {
        const html =
            '<p>Erika ist <strong>CTO</strong>.<br>Sie mag <em>Vue</em> und <a href="https://example.com">Blogs</a>.</p>'
        expect(markdownToHtml(htmlToMarkdown(html))).toBe(html)
    })
})
