import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, jest, test } from '@jest/globals'
import PDFDocument from 'pdfkit'
import {
    fitHeadingFontSize,
    generateInvoicePdf,
    HEADING_MAX_FONT_SIZE,
    HEADING_MIN_FONT_SIZE,
    HEADING_X,
    LOGO_RIGHT_EDGE,
    type InvoiceData,
} from '../invoice-generator.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

/**
 * A4 document with the real Museo Sans font, so measurements match what
 * generateInvoicePdf renders in production (Museo is wider than the
 * Helvetica fallback).
 */
function measuringDoc() {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    // Jest runs from the extension package root.
    const fontPath = path.resolve(process.cwd(), 'assets', 'MuseoSans700.otf')
    doc.registerFont('MuseoSans', fs.readFileSync(fontPath))
    doc.font('MuseoSans')
    return doc
}

describe('invoice heading layout', () => {
    test('heading block starts right of the logo bounding box', () => {
        expect(HEADING_X).toBeGreaterThan(LOGO_RIGHT_EDGE)
    })

    test('widest realistic headings fit on one line within the heading block', () => {
        const doc = measuringDoc()
        const headingWidth = doc.page.width - 50 - HEADING_X
        const measure = (text: string, size: number) => doc.fontSize(size).widthOfString(text)

        // Widest cases per document kind, including 4-digit sequence numbers.
        for (const heading of ['Rechnung', 'Rechnungsberichtigung', 'Stornorechnung']) {
            const text = `${heading} Nr.: PB-CON26-0499`
            const fontSize = fitHeadingFontSize(measure, text, headingWidth)

            expect(fontSize).toBeGreaterThanOrEqual(HEADING_MIN_FONT_SIZE)
            expect(fontSize).toBeLessThanOrEqual(HEADING_MAX_FONT_SIZE)
            // Fits on a single line at the fitted size — no wrap, no logo overlap.
            expect(measure(text, fontSize)).toBeLessThanOrEqual(headingWidth)
        }
    })

    test('a regular invoice heading keeps the original 18pt size', () => {
        const doc = measuringDoc()
        const headingWidth = doc.page.width - 50 - HEADING_X
        const measure = (text: string, size: number) => doc.fontSize(size).widthOfString(text)

        expect(fitHeadingFontSize(measure, 'Rechnung Nr.: PB-CON26-048', headingWidth)).toBe(HEADING_MAX_FONT_SIZE)
    })

    test('an absurdly long heading bottoms out at the minimum size instead of looping', () => {
        const measure = () => Number.MAX_SAFE_INTEGER
        expect(fitHeadingFontSize(measure, 'x'.repeat(500), 100)).toBe(HEADING_MIN_FONT_SIZE)
    })
})

describe('invoice meta block', () => {
    const BASE: InvoiceData = {
        invoiceNumber: 'PB-CON26-001',
        invoiceDate: '01.02.2026',
        serviceDate: '25.–26.11.2026',
        purchaserName: 'Erika Musterfrau',
        purchaserEmail: 'erika@example.de',
        companyName: null,
        companyVatId: null,
        billingAddressLine1: null,
        billingAddressLine2: null,
        billingCity: null,
        billingPostalCode: null,
        billingCountry: null,
        conferenceTitle: 'programmier.con 2026',
        ticketType: 'Regular',
        ticketCount: 1,
        unitPriceGrossCents: 11900,
        subtotalCents: 10000,
        discountAmountCents: 0,
        vatAmountCents: 1900,
        totalGrossCents: 11900,
    }

    /** Render the PDF and return every string passed to `doc.text`. */
    async function renderedTexts(data: InvoiceData): Promise<string[]> {
        const spy = jest.spyOn(PDFDocument.prototype, 'text')
        try {
            await generateInvoicePdf(data)
            return spy.mock.calls.map((call) => String(call[0]))
        } finally {
            spy.mockRestore()
        }
    }

    test.each([
        ['invoice', {}],
        ['correction', { referenceNumber: 'PB-CON26-000', referenceDate: '15.01.2026' }],
        [
            'cancellation',
            {
                referenceNumber: 'PB-CON26-000',
                referenceDate: '15.01.2026',
                // A Stornorechnung carries the referenced invoice's amounts negated.
                unitPriceGrossCents: -11900,
                subtotalCents: -10000,
                vatAmountCents: -1900,
                totalGrossCents: -11900,
            },
        ],
    ] as const)('a %s shows the Leistungsdatum (§ 14 Abs. 4 Nr. 6 UStG)', async (kind, reference) => {
        const texts = await renderedTexts({ ...BASE, documentKind: kind, ...reference } as InvoiceData)

        expect(texts).toContain('Rechnungsdatum: 01.02.2026')
        expect(texts).toContain('Leistungsdatum: 25.–26.11.2026')
    })

    test('omits the Leistungsdatum line when no service date is known', async () => {
        const texts = await renderedTexts({ ...BASE, serviceDate: null })

        expect(texts.some((text) => text.startsWith('Leistungsdatum'))).toBe(false)
        expect(texts).toContain('Fälligkeitsdatum: 01.02.2026')
    })
})
