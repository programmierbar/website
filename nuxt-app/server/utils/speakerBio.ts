import DOMPurify from 'isomorphic-dompurify'
import { Marked } from 'marked'
import TurndownService from 'turndown'
import { normalizeExternalUrl } from '../../helpers/normalizeExternalUrl'

// The speaker portal edits the rich-text `speakers.description` as Markdown: the CMS keeps storing
// HTML (every page renders it through `InnerHtml`), the speaker sees and types Markdown, and these
// two functions are the only place the formats meet. Both run on the server only, so neither
// library reaches the client bundle.

const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    // `marked` runs with `breaks: true`, so a plain newline already is a `<br>`. Turndown's default
    // of two trailing spaces would only add invisible characters to the editor.
    br: '',
})

// Turndown escapes most Markdown syntax in text, but not GFM strikethrough (`~x~` and `~~x~~`), which
// `marked` renders as `<del>` and the sanitiser then unwraps, or `1)` lists. Without these, `~~` in a
// bio would silently vanish on submit.
turndown.escape = (text: string) =>
    TurndownService.prototype.escape
        .call(turndown, text)
        .replace(/~/g, '\\~')
        .replace(/^(\d+)\)/, '$1\\)')

// Turndown's own list rule pads the marker to four columns (`-   Item`). Valid, but not what anyone
// types, and the editor hint promises lists written with `- `. Nested content is indented by the
// marker's width, which is what CommonMark needs to keep it inside the item.
turndown.addRule('listItem', {
    filter: 'li',
    replacement(content, node) {
        const parent = node.parentNode as HTMLElement | null
        let prefix = '- '

        if (parent?.nodeName === 'OL') {
            const start = Number(parent.getAttribute('start')) || 1
            prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `
        }

        const body = content
            .replace(/^\n+/, '')
            .replace(/\n+$/, '\n')
            .replace(/\n(?!$)/g, `\n${' '.repeat(prefix.length)}`)

        return prefix + body.trimEnd() + (node.nextSibling ? '\n' : '')
    },
})

/**
 * Turns the CMS rich text of a speaker bio into Markdown for the portal's editor.
 *
 * Every block — including blocks nested in other blocks and the items of nested lists — ends up on
 * its own line, so `<div>Intro<div>Details</div></div>` cannot run together into "IntroDetails".
 * A value without any tags is plain text: it keeps its line breaks (a newline is a `<br>` again on
 * submit) rather than having them collapsed as HTML whitespace rules would demand, but its Markdown
 * syntax is escaped line by line, so `*Beispiel*` stays literal asterisks as on the public pages.
 */
export function htmlToMarkdown(html: string | null | undefined): string {
    if (!html?.trim()) {
        return ''
    }

    if (!/<[a-z!/]/i.test(html)) {
        return (
            html
                .replace(/\r\n?/g, '\n')
                .trim()
                .split('\n')
                // Leading whitespace would turn a line into a code block; HTML collapses it anyway.
                .map((line) => turndown.escape(line.trim()))
                .join('\n')
        )
    }

    return turndown.turndown(html).trim()
}

const escapeAttribute = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const markdown = new Marked({
    gfm: true,
    // A single newline is a line break, as it was when the field was a plain textarea.
    breaks: true,
    renderer: {
        link({ href, tokens }) {
            const text = this.parser.parseInline(tokens)
            // Speakers leave the scheme off just like CMS editors do (`example.com/blog`), and a
            // link that resolves against our own domain only leads to a 404.
            const url = normalizeExternalUrl(href)

            return url && /^(?:https?|mailto):/i.test(url) ? `<a href="${escapeAttribute(url)}">${text}</a>` : text
        },
        // A bio has no use for headings; keep the line as emphasised text instead of letting the
        // sanitiser below strip the tag and run it into the next paragraph.
        heading({ tokens }) {
            return `<p><strong>${this.parser.parseInline(tokens)}</strong></p>\n`
        },
    },
})

// What a bio may contain. Anything else — raw HTML typed into the Markdown included — is removed;
// DOMPurify drops `<script>`, `<iframe>` and friends with their content and unwraps the rest.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'code']
const ALLOWED_ATTR = ['href']
const ALLOWED_URI_REGEXP = /^(?:https?|mailto):/i

/**
 * Turns the Markdown a speaker typed into the sanitised HTML the CMS stores.
 *
 * Only paragraphs, line breaks, emphasis, inline code, lists and http(s)/mailto links survive.
 */
export function markdownToHtml(text: string | null | undefined): string {
    if (!text?.trim()) {
        return ''
    }

    const html = markdown.parse(text.replace(/\r\n?/g, '\n'), { async: false })

    return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP }).trim()
}

/**
 * Whether a bio from `markdownToHtml` shows any text at all. An image, raw HTML or a few entities
 * pass as non-empty Markdown but leave nothing (or only `<p></p>`) once converted and sanitised.
 */
export function hasVisibleText(html: string): boolean {
    // Parsed rather than stripped with a regex, so entities such as `&nbsp;` count as what they are.
    const text = DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOWED_URI_REGEXP,
        RETURN_DOM: true,
    }).textContent
    // `\s` covers the no-break space; zero-width characters are invisible too.
    return !!text?.replace(/[\s\u200b-\u200d\u2060]/g, '')
}
