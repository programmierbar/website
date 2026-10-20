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

    it('escapes Markdown syntax in plain text without tags, keeping its line breaks', () => {
        // A bio without tags is plain text: the public pages show its `*` literally, so the editor
        // must not hand it on as emphasis.
        expect(htmlToMarkdown('Erika arbeitet bei *Beispiel*.\r\nZweite Zeile')).toBe(
            'Erika arbeitet bei \\*Beispiel\\*.\nZweite Zeile'
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

        it('drops aria-* and data-* attributes, which DOMPurify allows by default', () => {
            // `aria-hidden` would hide the whole bio from screen readers.
            expect(markdownToHtml('<p aria-hidden="true">Erika</p>')).toBe('<p>Erika</p>')
            expect(markdownToHtml('<b data-foo="bar" aria-label="x">fett</b>')).toBe('<p><b>fett</b></p>')
            expect(markdownToHtml('<a href="https://example.com" data-foo="bar">x</a>')).toBe(
                '<p><a href="https://example.com">x</a></p>'
            )
        })
    })

    it('round-trips a plain-text CMS bio without turning its characters into formatting', () => {
        const text = [
            'Erika arbeitet bei *Beispiel* & _Co_ ~~seit~~ 2020.',
            '# kein Titel',
            '- kein Listenpunkt',
            '1. keine Liste, 2) auch nicht',
            '> kein Zitat',
            '    eingerückt, `kein Code`',
            '[kein Link](https://example.com) C:\\Pfad',
            '',
            '---',
        ].join('\n')
        expect(markdownToHtml(htmlToMarkdown(text))).toBe(
            '<p>Erika arbeitet bei *Beispiel* &amp; _Co_ ~~seit~~ 2020.<br># kein Titel<br>- kein Listenpunkt<br>' +
                '1. keine Liste, 2) auch nicht<br>&gt; kein Zitat<br>eingerückt, `kein Code`<br>' +
                // A bare URL becomes a link (GFM autolink), its visible text stays the same.
                '[kein Link](<a href="https://example.com">https://example.com</a>) C:\\Pfad</p>\n<p>---</p>'
        )
    })

    it('round-trips literal Markdown characters in the text of CMS rich text', () => {
        const html = '<p>Erika arbeitet bei *Beispiel* &amp; _Co_ ~~seit~~ 2020 [Team].</p>'
        expect(markdownToHtml(htmlToMarkdown(html))).toBe(html)
    })

    it('round-trips encoded tags in CMS rich text as text', () => {
        // Decoded, the text would be a real `<script>` in the Markdown, which the sanitiser deletes.
        const html = '<p>Erika erklärt &lt;script&gt;alert(1)&lt;/script&gt; und &lt;b&gt;fett&lt;/b&gt;.</p>'
        const md = htmlToMarkdown(html)
        expect(md).toBe('Erika erklärt \\<script>alert(1)\\</script> und \\<b>fett\\</b>.')
        expect(markdownToHtml(md)).toBe(html)
        expect(markdownToHtml(htmlToMarkdown('<p>&lt;!-- kein Kommentar --&gt; &lt;?php ?&gt;</p>'))).toBe(
            '<p>&lt;!-- kein Kommentar --&gt; &lt;?php ?&gt;</p>'
        )
    })

    it('round-trips text that would be an email autolink, also with a digit in front', () => {
        // `<` before a digit is no tag, but `<123@example.com>` is a CommonMark email autolink, which
        // would lose its brackets. A bare address still becomes a link (GFM), its text stays the same.
        const visibleText = (html: string) => html.replace(/<[^>]*>/g, '')
        const html = '<p>Mail: &lt;123@example.com&gt; &lt;&lt;mailto:123@example.com|123@example.com&gt;&gt;</p>'
        expect(visibleText(markdownToHtml(htmlToMarkdown(html)))).toBe(visibleText(html))
        // Without tags, too, where `<1` is plain text on the public pages.
        expect(visibleText(markdownToHtml(htmlToMarkdown('Mail: <123@example.com> <3')))).toBe(
            'Mail: &lt;123@example.com&gt; &lt;3'
        )
    })

    it('round-trips double-encoded entities in CMS rich text as text', () => {
        const html = '<p>&amp;copy; &amp;amp; &amp;#169; &amp;#x41;</p>'
        const md = htmlToMarkdown(html)
        expect(md).toBe('\\&copy; \\&amp; \\&#169; \\&#x41;')
        expect(markdownToHtml(md)).toBe(html)
    })

    it('keeps an ordinary & and < readable in the editor', () => {
        const html = '<p>Tom &amp; Jerry &lt;3, a &lt; b, AT&amp;T, &amp;copy ohne Semikolon</p>'
        const md = htmlToMarkdown(html)
        expect(md).toBe('Tom & Jerry <3, a < b, AT&T, &copy ohne Semikolon')
        expect(markdownToHtml(md)).toBe(html)
    })

    it('keeps entities in a plain-text CMS bio as the public pages show them', () => {
        // Without tags the CMS value is still rendered as HTML, so `&copy;` shows as ©.
        expect(htmlToMarkdown('&copy; 2020 Tom & Jerry <3')).toBe('&copy; 2020 Tom & Jerry <3')
        expect(markdownToHtml(htmlToMarkdown('&copy; 2020 Tom & Jerry <3'))).toBe('<p>© 2020 Tom &amp; Jerry &lt;3</p>')
    })

    it('keeps the start number of ordered lists', () => {
        expect(htmlToMarkdown('<ol start="3"><li>a</li><li>b</li></ol>')).toBe('3. a\n4. b')
        expect(markdownToHtml('3. a\n4. b')).toBe('<ol start="3">\n<li>a</li>\n<li>b</li>\n</ol>')
        const html = '<ol start="3">\n<li>a</li>\n<li>b</li>\n</ol>'
        expect(markdownToHtml(htmlToMarkdown(html))).toBe(html)
    })

    it('allows start only as a positive number on ordered lists', () => {
        expect(markdownToHtml('<p start="3">a</p>')).toBe('<p>a</p>')
        expect(markdownToHtml('<ul start="3"><li>a</li></ul>')).toBe('<ul><li>a</li></ul>')
        expect(markdownToHtml('<ol start="x"><li>a</li></ol>')).toBe('<ol><li>a</li></ol>')
        expect(markdownToHtml('<ol start="-1"><li>a</li></ol>')).toBe('<ol><li>a</li></ol>')
        expect(markdownToHtml('<ol start="12"><li>a</li></ol>')).toBe('<ol start="12"><li>a</li></ol>')
    })

    it('round-trips CMS rich text', () => {
        const html =
            '<p>Erika ist <strong>CTO</strong>.<br>Sie mag <em>Vue</em> und <a href="https://example.com">Blogs</a>.</p>'
        expect(markdownToHtml(htmlToMarkdown(html))).toBe(html)
    })
})
