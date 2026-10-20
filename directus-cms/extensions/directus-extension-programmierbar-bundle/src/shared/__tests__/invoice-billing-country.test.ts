import { describe, expect, jest, test } from '@jest/globals'
import PDFDocument from 'pdfkit'
import { generateInvoicePdf, type InvoiceData } from '../invoice-generator.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

const INVOICE: InvoiceData = {
    invoiceNumber: 'PB-CON26-001',
    invoiceDate: '20.10.2026',
    purchaserName: 'Mika Muster',
    purchaserEmail: 'mika@example.com',
    companyName: 'Beispiel GmbH',
    companyVatId: null,
    billingAddressLine1: 'Musterstraße 1',
    billingAddressLine2: null,
    billingCity: 'Wien',
    billingPostalCode: '1010',
    billingCountry: null,
    conferenceTitle: 'Konferenz 2026',
    ticketType: 'Regular',
    ticketCount: 1,
    unitPriceGrossCents: 11900,
    subtotalCents: 10000,
    discountAmountCents: 0,
    vatAmountCents: 1900,
    totalGrossCents: 11900,
}

/** Render the invoice and return every string drawn into it. */
async function renderedTexts(billingCountry: string | null) {
    const text = jest.spyOn(PDFDocument.prototype, 'text')
    try {
        await generateInvoicePdf({ ...INVOICE, billingCountry })
        return text.mock.calls.map(([value]) => value)
    } finally {
        text.mockRestore()
    }
}

describe('invoice billing country', () => {
    test('prints an ISO code as the German country name', async () => {
        const texts = await renderedTexts('AT')

        expect(texts).toContain('Österreich')
        expect(texts).not.toContain('AT')
    })

    test('prints legacy free text exactly as it was entered', async () => {
        expect(await renderedTexts('Germany')).toContain('Germany')
        expect(await renderedTexts('Deutschland')).toContain('Deutschland')
    })

    test('prints no country line when the country is missing or blank', async () => {
        const withCountry = await renderedTexts('AT')

        for (const missing of [null, '', '   ']) {
            const texts = await renderedTexts(missing)
            expect(texts).toEqual(withCountry.filter((value) => value !== 'Österreich'))
        }
    })
})
