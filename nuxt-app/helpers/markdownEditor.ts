import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdownKeymap, markdownLanguage, pasteURLAsLink } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderText } from '@codemirror/view'
import { tags } from '@lezer/highlight'

// The CodeMirror setup behind `components/MarkdownEditor.vue`. Only ever loaded with a dynamic
// `import()` from that component, so CodeMirror lands in its own chunk and is fetched on the one page
// that shows the editor — keep it out of `helpers/index.ts`.

/**
 * Caps the document at `max` characters for what the user types, pastes or drops, the way `maxlength`
 * does on a textarea: a paste that would overflow is cut to fit rather than rejected.
 *
 * Programmatic changes (setting the value from outside) and undo are left alone, and a document that
 * already starts over the limit — a long prefilled bio — can still be edited as long as it does not
 * grow. The server validates the length again either way.
 */
export function maxLength(max: number): Extension {
    return EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged || !tr.isUserEvent('input')) {
            return tr
        }

        let excess = tr.newDoc.length - Math.max(max, tr.startState.doc.length)

        if (excess <= 0) {
            return tr
        }

        const changes: { from: number; to: number; insert: string }[] = []
        tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
            changes.push({ from, to, insert: inserted.toString() })
        })

        // Trim from the end, so the start of a paste is what survives.
        for (let i = changes.length - 1; i >= 0 && excess > 0; i--) {
            const change = changes[i]!
            const cut = Math.min(excess, change.insert.length)
            change.insert = change.insert.slice(0, change.insert.length - cut)
            excess -= cut
        }

        const changeSet = tr.startState.changes(changes)
        const last = changes[changes.length - 1]!

        return {
            changes: changeSet,
            selection: EditorSelection.cursor(changeSet.mapPos(last.to, 1)),
            userEvent: 'input',
            scrollIntoView: true,
        }
    })
}

// Classes rather than inline styles, so the colours come from the Tailwind theme (see the component).
const highlightStyle = HighlightStyle.define([
    { tag: tags.processingInstruction, class: 'cm-md-mark' },
    { tag: tags.strong, class: 'cm-md-strong' },
    { tag: tags.emphasis, class: 'cm-md-emphasis' },
    { tag: tags.link, class: 'cm-md-link' },
    { tag: tags.url, class: 'cm-md-url' },
    { tag: tags.monospace, class: 'cm-md-code' },
    {
        tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
        class: 'cm-md-heading',
    },
    { tag: tags.quote, class: 'cm-md-quote' },
    { tag: tags.escape, class: 'cm-md-escape' },
])

// `dark: true` switches CodeMirror's own defaults (selection, cursor) to their dark variants; the
// remaining look is in the component's stylesheet.
const darkTheme = EditorView.theme(
    {
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#CFFF00' },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
            backgroundColor: 'rgba(0, 161, 255, 0.35)',
        },
    },
    { dark: true }
)

export interface MarkdownEditorOptions {
    doc: string
    onChange: (value: string) => void
    placeholder?: string
    maxLength?: number
    /** Attributes for the editable element, e.g. `aria-labelledby` or `aria-required`. */
    contentAttributes?: Record<string, string>
}

export function createMarkdownEditor(parent: HTMLElement, options: MarkdownEditorOptions): EditorView {
    return new EditorView({
        parent,
        state: EditorState.create({
            doc: options.doc,
            extensions: [
                history(),
                // Enter continues a list, Backspace removes an empty list marker.
                keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
                // GFM, matching what the server renders with `marked`. The language itself rather than
                // `markdown()`, which would also bundle the HTML, CSS and JavaScript modes for raw HTML
                // inside Markdown — over a third of the chunk, for something a bio should not contain.
                markdownLanguage,
                pasteURLAsLink,
                syntaxHighlighting(highlightStyle),
                darkTheme,
                EditorView.lineWrapping,
                EditorView.contentAttributes.of(options.contentAttributes ?? {}),
                options.placeholder ? placeholderText(options.placeholder) : [],
                options.maxLength ? maxLength(options.maxLength) : [],
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        options.onChange(update.state.doc.toString())
                    }
                }),
            ],
        }),
    })
}
