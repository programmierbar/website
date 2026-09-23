import { describe, expect, test } from '@jest/globals'
import {
    deriveInvoiceActionsState,
    isExistingItemKey,
    type InvoiceDocumentRow,
} from '../invoice-actions-state.ts'

function doc(overrides: Partial<InvoiceDocumentRow> & Pick<InvoiceDocumentRow, 'id' | 'type'>): InvoiceDocumentRow {
    return {
        invoice_number: 'PB-CON26-001',
        sent_at: null,
        related_invoice: null,
        ...overrides,
    }
}

describe('isExistingItemKey', () => {
    test("is false for the create page key '+'", () => {
        expect(isExistingItemKey('+')).toBe(false)
    })

    // Directus passes '+' (or no key) while the item record is still loading and
    // only swaps in the real key afterwards — the interface must not treat that
    // transient state as an existing item.
    test('is false for missing keys', () => {
        expect(isExistingItemKey(undefined)).toBe(false)
        expect(isExistingItemKey(null)).toBe(false)
        expect(isExistingItemKey('')).toBe(false)
    })

    test('is true for a real primary key', () => {
        expect(isExistingItemKey('3606e446-42c0-4450-ada5-56aca41ced3b')).toBe(true)
    })
})

describe('deriveInvoiceActionsState', () => {
    test('shows nothing when the order has no invoice at all', () => {
        const state = deriveInvoiceActionsState(null, [])

        expect(state).toEqual({
            hasInvoice: false,
            isCancelled: false,
            showRegenerate: false,
            showPostIssuanceActions: false,
        })
    })

    // Orders invoiced before the ticket_invoices collection existed have an
    // invoice_number but no document rows; those invoices were all emailed,
    // so they count as issued.
    test('legacy order with invoice_number but no documents gets post-issuance actions', () => {
        const state = deriveInvoiceActionsState('PB-CON26-040', [])

        expect(state.hasInvoice).toBe(true)
        expect(state.showRegenerate).toBe(false)
        expect(state.showPostIssuanceActions).toBe(true)
    })

    test('unsent original allows regenerate only', () => {
        const state = deriveInvoiceActionsState('PB-CON26-001', [doc({ id: 'doc-1', type: 'original' })])

        expect(state.showRegenerate).toBe(true)
        expect(state.showPostIssuanceActions).toBe(false)
    })

    test('sent original allows correction and cancellation only', () => {
        const state = deriveInvoiceActionsState('PB-CON26-001', [
            doc({ id: 'doc-1', type: 'original', sent_at: '2026-01-20T10:00:00.000Z' }),
        ])

        expect(state.showRegenerate).toBe(false)
        expect(state.showPostIssuanceActions).toBe(true)
    })

    test('the latest correction supersedes the original', () => {
        const state = deriveInvoiceActionsState('PB-CON26-001', [
            doc({ id: 'doc-1', type: 'original', sent_at: '2026-01-20T10:00:00.000Z' }),
            doc({ id: 'doc-2', type: 'correction', invoice_number: 'PB-CON26-002' }),
        ])

        // The unsent correction is the current document, so regeneration applies.
        expect(state.showRegenerate).toBe(true)
        expect(state.showPostIssuanceActions).toBe(false)
    })

    test('a cancelled current document blocks all actions', () => {
        const state = deriveInvoiceActionsState('PB-CON26-001', [
            doc({ id: 'doc-1', type: 'original', sent_at: '2026-01-20T10:00:00.000Z' }),
            doc({ id: 'doc-2', type: 'cancellation', invoice_number: 'PB-CON26-003', related_invoice: 'doc-1' }),
        ])

        expect(state.isCancelled).toBe(true)
        expect(state.showRegenerate).toBe(false)
        expect(state.showPostIssuanceActions).toBe(false)
    })

    test('a cancellation of a superseded document does not block the current one', () => {
        const state = deriveInvoiceActionsState('PB-CON26-001', [
            doc({ id: 'doc-1', type: 'original', sent_at: '2026-01-20T10:00:00.000Z' }),
            doc({ id: 'doc-2', type: 'cancellation', invoice_number: 'PB-CON26-003', related_invoice: 'doc-1' }),
            doc({ id: 'doc-3', type: 'correction', invoice_number: 'PB-CON26-004', sent_at: '2026-01-21T10:00:00.000Z' }),
        ])

        expect(state.isCancelled).toBe(false)
        expect(state.showPostIssuanceActions).toBe(true)
    })
})
