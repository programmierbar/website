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

    it('leaves programmatic changes alone', () => {
        const tr = state('').update({ changes: { from: 0, insert: 'a long prefilled value' } })
        expect(tr.state.doc.toString()).toBe('a long prefilled value')
    })
})
