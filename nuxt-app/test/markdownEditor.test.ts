import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { maxLength } from '../helpers/markdownEditor'

// The bio editor replaces a textarea with `maxlength="2000"`; this pins down that it still behaves
// like one.
describe('maxLength', () => {
    const state = (doc: string) => EditorState.create({ doc, extensions: maxLength(10) })

    it('lets input through below the limit', () => {
        const tr = state('Hallo').update({ changes: { from: 5, insert: ' Welt' }, userEvent: 'input.type' })
        expect(tr.state.doc.toString()).toBe('Hallo Welt')
    })

    it('blocks typing at the limit', () => {
        const tr = state('0123456789').update({ changes: { from: 10, insert: 'x' }, userEvent: 'input.type' })
        expect(tr.state.doc.toString()).toBe('0123456789')
    })

    it('cuts a paste to fit and puts the cursor after it', () => {
        const tr = state('Hallo').update({ changes: { from: 5, insert: ' schöne Welt' }, userEvent: 'input.paste' })
        expect(tr.state.doc.toString()).toBe('Hallo schö')
        expect(tr.state.selection.main.head).toBe(10)
    })

    it('counts what a paste replaces', () => {
        const tr = state('0123456789').update({
            changes: { from: 0, to: 4, insert: 'abcdefgh' },
            userEvent: 'input.paste',
        })
        expect(tr.state.doc.toString()).toBe('abcd456789')
    })

    it('keeps a prefilled text over the limit editable without letting it grow', () => {
        const long = state('0123456789AB')
        expect(long.update({ changes: { from: 0, to: 1 }, userEvent: 'delete' }).state.doc.length).toBe(11)
        expect(long.update({ changes: { from: 12, insert: 'x' }, userEvent: 'input.type' }).state.doc.length).toBe(12)
    })

    describe('never cuts a character in half', () => {
        // Emoji and other characters outside the BMP are two UTF-16 code units. The limit counts code
        // units, like `maxlength`, the counter and the server's `max(2000)`, but a cut between the two
        // halves would leave a lone surrogate that renders as garbage and is sent to the server.
        const isWellFormed = (value: string) =>
            !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)

        it('drops an emoji that only half fits', () => {
            const tr = state('012345678').update({ changes: { from: 9, insert: '😀' }, userEvent: 'input.paste' })
            expect(tr.state.doc.toString()).toBe('012345678')
            expect(isWellFormed(tr.state.doc.toString())).toBe(true)
        })

        it('drops the half-fitting emoji at the end of a longer paste', () => {
            const tr = state('0123456').update({ changes: { from: 7, insert: 'ab😀' }, userEvent: 'input.paste' })
            expect(tr.state.doc.toString()).toBe('0123456ab')
            expect(tr.state.selection.main.head).toBe(9)
        })

        it('keeps an emoji that fits exactly', () => {
            const tr = state('01234567').update({ changes: { from: 8, insert: '😀' }, userEvent: 'input.paste' })
            expect(tr.state.doc.toString()).toBe('01234567😀')
        })

        it('cuts plain text right at the limit', () => {
            const tr = state('0123456').update({ changes: { from: 7, insert: 'abcdef' }, userEvent: 'input.paste' })
            expect(tr.state.doc.toString()).toBe('0123456abc')
        })
    })

    it('leaves programmatic changes alone', () => {
        const tr = state('').update({ changes: { from: 0, insert: 'a long prefilled value' } })
        expect(tr.state.doc.toString()).toBe('a long prefilled value')
    })
})
