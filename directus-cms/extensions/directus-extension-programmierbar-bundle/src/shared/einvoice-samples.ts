import {
    buildInvoiceSnapshot,
    negateInvoiceSnapshot,
    renderAndUploadInvoice,
    type InvoiceOrder,
    type RenderInvoiceParams,
} from './invoice-service.js'

/**
 * Sample documents covering every e-invoice variant ticket orders produce. Rendered
 * through the real snapshot → `renderAndUploadInvoice` path (with a capturing files
 * service instead of Directus), so the validated files are exactly what customers get.
 * Used by `npm run einvoice:validate` and the e-invoice tests.
 */

const CONFERENCE = { title: 'programmier.con 2026', start_on: '2026-11-25', end_on: '2026-11-26' }

/** Mirrors the checkout's pricing (nuxt-app create-checkout.post.ts). */
function pricedOrder(
    base: Omit<
        InvoiceOrder,
        'subtotal_cents' | 'discount_amount_cents' | 'total_cents' | 'total_gross_cents' | 'vat_amount_cents'
    >,
    ticketCount: number,
    basePriceNetCents: number,
    discountPriceNetCents: number | null = null
): InvoiceOrder {
    const unitNet = discountPriceNetCents ?? basePriceNetCents
    const subtotal = ticketCount * basePriceNetCents
    const discount = discountPriceNetCents === null ? 0 : ticketCount * (basePriceNetCents - discountPriceNetCents)
    const totalNet = subtotal - discount
    const totalGross = ticketCount * Math.round(unitNet * 1.19)
    return {
        ...base,
        subtotal_cents: subtotal,
        discount_amount_cents: discount,
        total_cents: totalNet,
        total_gross_cents: totalGross,
        vat_amount_cents: totalGross - totalNet,
    }
}

const COMPANY_BUYER = {
    id: 'order-1',
    order_number: 'ORD-2026-SAMPLE',
    purchaser_first_name: 'Erika',
    purchaser_last_name: 'Musterfrau',
    purchaser_email: 'erika@example.com',
    company_name: 'Beispiel GmbH',
    company_vat_id: 'DE 123 456 789',
    billing_address_line1: 'Musterstraße 1',
    billing_address_line2: '2. OG',
    billing_city: 'Frankfurt am Main',
    billing_postal_code: '60311',
    billing_country: 'DE',
}

const PRIVATE_BUYER = {
    id: 'order-2',
    order_number: 'ORD-2026-PRIVAT',
    purchaser_first_name: 'Max',
    purchaser_last_name: 'Mustermann',
    purchaser_email: 'max@example.com',
    company_name: null,
    company_vat_id: null,
    billing_address_line1: 'Beispielweg 5',
    billing_address_line2: null,
    billing_city: 'Berlin',
    billing_postal_code: '10115',
    billing_country: 'DE',
}

export interface EInvoiceSample {
    /** File name stem, e.g. "rechnung". */
    name: string
    pdf: Buffer
    fileName: string
}

type SampleParams = Omit<RenderInvoiceParams, 'filesService'>

async function render(name: string, params: SampleParams): Promise<EInvoiceSample> {
    const filesService = { uploadOne: async () => 'sample-file' }
    const result = await renderAndUploadInvoice({ ...params, filesService } as RenderInvoiceParams)
    return { name, pdf: result.pdfBuffer, fileName: result.invoiceFileName }
}

/** All sample documents: the three document types plus the edge cases of the amount mapping. */
export async function renderEInvoiceSamples(): Promise<EInvoiceSample[]> {
    const invoiceDate = new Date(2026, 9, 20)
    const correctionDate = new Date(2026, 9, 27)

    // Two tickets bought with a discount code (Rabatt line), company with USt-IdNr.
    const discounted = pricedOrder({ ...COMPANY_BUYER, ticket_type: 'discounted' }, 2, 39900, 29900)
    const original = buildInvoiceSnapshot(discounted, CONFERENCE.title, 2, CONFERENCE)
    // The correction changes the billing address; amounts stay the same.
    const corrected = buildInvoiceSnapshot(
        { ...discounted, billing_address_line2: null, billing_city: 'Offenbach am Main', billing_postal_code: '63065' },
        CONFERENCE.title,
        2,
        CONFERENCE
    )

    return [
        await render('rechnung', { snapshot: original, invoiceNumber: 'PB-CON26-001', invoiceDate }),
        await render('rechnungsberichtigung', {
            snapshot: corrected,
            invoiceNumber: 'PB-CON26-002',
            invoiceDate: correctionDate,
            documentKind: 'correction',
            referenceNumber: 'PB-CON26-001',
            referenceDate: invoiceDate,
        }),
        await render('stornorechnung', {
            snapshot: negateInvoiceSnapshot(corrected),
            invoiceNumber: 'PB-CON26-003',
            invoiceDate: correctionDate,
            documentKind: 'cancellation',
            referenceNumber: 'PB-CON26-002',
            referenceDate: correctionDate,
        }),
        // Private buyer (one without any address gets a plain PDF, see the tests).
        await render('rechnung-privat', {
            snapshot: buildInvoiceSnapshot(
                pricedOrder({ ...PRIVATE_BUYER, ticket_type: 'regular' }, 1, 39900),
                CONFERENCE.title,
                1,
                { start_on: '2026-11-25', end_on: '2026-11-25' }
            ),
            invoiceNumber: 'PB-CON26-004',
            invoiceDate,
        }),
        // External order with a 100 % discount code: a 0 € invoice.
        await render('rechnung-0-euro', {
            snapshot: buildInvoiceSnapshot(
                pricedOrder({ ...PRIVATE_BUYER, ticket_type: 'discounted' }, 1, 39900, 0),
                CONFERENCE.title,
                1,
                CONFERENCE
            ),
            invoiceNumber: 'PB-CON26-005',
            invoiceDate,
        }),
        // Non-round price × 3: per-ticket VAT rounding is 1 cent off BR-CO-17's exact value.
        await render('rechnung-rundung', {
            snapshot: buildInvoiceSnapshot(
                pricedOrder({ ...COMPANY_BUYER, ticket_type: 'regular' }, 3, 9999),
                CONFERENCE.title,
                3,
                CONFERENCE
            ),
            invoiceNumber: 'PB-CON26-006',
            invoiceDate,
        }),
    ]
}
