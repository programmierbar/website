import { describe, expect, jest, test } from '@jest/globals'
import {
    buildFacturXXml,
    buyerCountryCode,
    EInvoiceDataError,
    expectedVatCents,
    normalizeVatId,
    unitPriceNetCents,
} from '../einvoice.ts'
import { generateInvoicePdf, SELLER, type InvoiceData } from '../invoice-generator.ts'
import { embeddedFileSpec, extractEmbeddedFile, pdfMetadata } from './pdf-inspect.ts'

// `import.meta.url` in the font loader cannot be parsed by Jest's CJS transform.
jest.mock('../museo-font.ts', () => ({ tryLoadMuseoFont: () => null }))

/** 2 tickets at 399 € net, bought with a discount code for 299 € (as the checkout prices it). */
const INVOICE: InvoiceData = {
    invoiceNumber: 'PB-CON26-001',
    invoiceDate: '20.10.2026',
    serviceDate: '25.–26.11.2026',
    servicePeriodStart: '2026-11-25',
    servicePeriodEnd: '2026-11-26',
    purchaserName: 'Erika Musterfrau',
    purchaserEmail: 'erika@example.com',
    companyName: 'Beispiel GmbH',
    companyVatId: 'DE 123 456 789',
    billingAddressLine1: 'Musterstraße 1',
    billingAddressLine2: '2. OG',
    billingCity: 'Frankfurt am Main',
    billingPostalCode: '60311',
    billingCountry: 'DE',
    conferenceTitle: 'programmier.con 2026',
    ticketType: 'Discounted',
    ticketCount: 2,
    unitPriceGrossCents: 47481, // round(39900 × 1.19)
    subtotalCents: 79800,
    discountAmountCents: 20000,
    vatAmountCents: 11362, // 2 × (round(29900 × 1.19) − 29900)
    totalGrossCents: 71162,
    documentKind: 'invoice',
}

const REFERENCE = { referenceNumber: 'PB-CON26-000', referenceDate: '15.10.2026' }

const CORRECTION: InvoiceData = { ...INVOICE, documentKind: 'correction', ...REFERENCE }

/** What the invoice-lifecycle endpoint renders from a negated snapshot. */
const CANCELLATION: InvoiceData = {
    ...INVOICE,
    unitPriceGrossCents: -47481,
    subtotalCents: -79800,
    discountAmountCents: -20000,
    vatAmountCents: -11362,
    totalGrossCents: -71162,
    documentKind: 'cancellation',
    ...REFERENCE,
}

const PRIVATE: InvoiceData = {
    ...INVOICE,
    companyName: null,
    companyVatId: null,
    billingAddressLine1: null,
    billingAddressLine2: null,
    billingCity: null,
    billingPostalCode: null,
    billingCountry: null,
    ticketType: 'Regular',
    ticketCount: 1,
    unitPriceGrossCents: 47481,
    subtotalCents: 39900,
    discountAmountCents: 0,
    vatAmountCents: 7581,
    totalGrossCents: 47481,
}

/** Text of the first element with this tag (optionally below a parent tag). */
function value(xml: string, tag: string, within?: string): string | undefined {
    const scope = within ? (new RegExp(`<${within}>([\\s\\S]*?)</${within}>`).exec(xml)?.[1] ?? '') : xml
    return new RegExp(`<${tag}(?: [^>]*)?>([^<]*)</${tag}>`).exec(scope)?.[1]
}

const SUMMATION = 'ram:SpecifiedTradeSettlementHeaderMonetarySummation'

describe('buildFacturXXml', () => {
    test('declares the EN 16931 profile', () => {
        const xml = buildFacturXXml(INVOICE, SELLER)
        expect(value(xml, 'ram:ID', 'ram:GuidelineSpecifiedDocumentContextParameter')).toBe('urn:cen.eu:en16931:2017')
        expect(value(xml, 'ram:ID', 'rsm:ExchangedDocument')).toBe('PB-CON26-001')
        expect(xml).toContain('<ram:IssueDateTime><udt:DateTimeString format="102">20261020</udt:DateTimeString>')
    })

    test.each([
        ['invoice', INVOICE, '380'],
        ['correction', CORRECTION, '384'],
        ['cancellation', CANCELLATION, '381'],
    ] as const)('a %s has type code %s', (_kind, data, typeCode) => {
        expect(value(buildFacturXXml(data, SELLER), 'ram:TypeCode', 'rsm:ExchangedDocument')).toBe(typeCode)
    })

    test('maps the printed amounts of an invoice with a discount', () => {
        const xml = buildFacturXXml(INVOICE, SELLER)

        // Line: printed Einzelpreis × Anzahl = Gesamtpreis.
        expect(value(xml, 'ram:ChargeAmount', 'ram:NetPriceProductTradePrice')).toBe('399.00')
        expect(xml).toContain('<ram:BilledQuantity unitCode="C62">2</ram:BilledQuantity>')
        expect(value(xml, 'ram:LineTotalAmount', 'ram:SpecifiedTradeSettlementLineMonetarySummation')).toBe('798.00')

        // The Rabatt line is a document-level allowance.
        expect(value(xml, 'ram:ActualAmount', 'ram:SpecifiedTradeAllowanceCharge')).toBe('200.00')
        expect(value(xml, 'ram:Reason', 'ram:SpecifiedTradeAllowanceCharge')).toBe('Rabatt')

        expect(value(xml, 'ram:LineTotalAmount', SUMMATION)).toBe('798.00')
        expect(value(xml, 'ram:AllowanceTotalAmount', SUMMATION)).toBe('200.00')
        expect(value(xml, 'ram:TaxBasisTotalAmount', SUMMATION)).toBe('598.00')
        expect(value(xml, 'ram:TaxTotalAmount', SUMMATION)).toBe('113.62')
        expect(value(xml, 'ram:GrandTotalAmount', SUMMATION)).toBe('711.62')
        // Paid upfront via the online checkout.
        expect(value(xml, 'ram:TotalPrepaidAmount', SUMMATION)).toBe('711.62')
        expect(value(xml, 'ram:DuePayableAmount', SUMMATION)).toBe('0.00')
        expect(value(xml, 'ram:TypeCode', 'ram:SpecifiedTradeSettlementPaymentMeans')).toBe('68')

        // VAT breakdown: category S, 19 %.
        expect(value(xml, 'ram:CalculatedAmount')).toBe('113.62')
        expect(value(xml, 'ram:BasisAmount')).toBe('598.00')
        expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>')
        expect(xml).toContain('<ram:RateApplicablePercent>19</ram:RateApplicablePercent>')
    })

    test('carries seller and buyer identification', () => {
        const xml = buildFacturXXml(INVOICE, SELLER)

        expect(value(xml, 'ram:Name', 'ram:SellerTradeParty')).toBe('Lotum media GmbH')
        expect(xml).toContain('<ram:ID schemeID="VA">DE272856704</ram:ID>')
        expect(xml).toContain('<ram:ID schemeID="FC">020 238 63371</ram:ID>')

        expect(value(xml, 'ram:Name', 'ram:BuyerTradeParty')).toBe('Beispiel GmbH')
        expect(value(xml, 'ram:PersonName', 'ram:BuyerTradeParty')).toBe('Erika Musterfrau')
        expect(value(xml, 'ram:CountryID', 'ram:BuyerTradeParty')).toBe('DE')
        expect(value(xml, 'ram:PostcodeCode', 'ram:BuyerTradeParty')).toBe('60311')
        expect(value(xml, 'ram:LineTwo', 'ram:BuyerTradeParty')).toBe('2. OG')
        expect(xml).toContain('<ram:URIID schemeID="EM">erika@example.com</ram:URIID>')
        // The free-text USt-IdNr. is normalized for BT-48.
        expect(xml).toContain('<ram:ID schemeID="VA">DE123456789</ram:ID>')
    })

    test('carries the conference dates as invoicing period, or as delivery date for a single day', () => {
        const period = buildFacturXXml(INVOICE, SELLER)
        expect(period).toContain(
            '<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">20261125</udt:DateTimeString></ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">20261126</udt:DateTimeString></ram:EndDateTime></ram:BillingSpecifiedPeriod>'
        )
        expect(period).not.toContain('ActualDeliverySupplyChainEvent')

        const singleDay = buildFacturXXml({ ...INVOICE, servicePeriodEnd: '2026-11-25' }, SELLER)
        expect(singleDay).toContain(
            '<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">20261125</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>'
        )
        expect(singleDay).not.toContain('BillingSpecifiedPeriod')

        const unknown = buildFacturXXml({ ...INVOICE, servicePeriodStart: null, servicePeriodEnd: null }, SELLER)
        expect(unknown).not.toContain('BillingSpecifiedPeriod')
        expect(unknown).not.toContain('ActualDeliverySupplyChainEvent')
    })

    test('a correction references the corrected invoice (BT-25/BT-26)', () => {
        const xml = buildFacturXXml(CORRECTION, SELLER)
        expect(xml).toContain(
            '<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>PB-CON26-000</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">20261015</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>'
        )
        expect(value(xml, 'ram:Content')).toBe(
            'Diese Rechnungsberichtigung berichtigt und ersetzt die Rechnung Nr. PB-CON26-000 vom 15.10.2026.'
        )
        expect(value(xml, 'ram:GrandTotalAmount', SUMMATION)).toBe('711.62')
        expect(value(xml, 'ram:DuePayableAmount', SUMMATION)).toBe('0.00')
    })

    test('a cancellation is a credit note with the printed negative amounts as positive values', () => {
        const xml = buildFacturXXml(CANCELLATION, SELLER)

        expect(xml).toContain('<ram:IssuerAssignedID>PB-CON26-000</ram:IssuerAssignedID>')
        expect(value(xml, 'ram:Content')).toBe(
            'Diese Stornorechnung storniert die Rechnung Nr. PB-CON26-000 vom 15.10.2026.'
        )
        expect(value(xml, 'ram:ChargeAmount', 'ram:NetPriceProductTradePrice')).toBe('399.00')
        expect(value(xml, 'ram:ActualAmount', 'ram:SpecifiedTradeAllowanceCharge')).toBe('200.00')
        expect(value(xml, 'ram:TaxTotalAmount', SUMMATION)).toBe('113.62')
        expect(value(xml, 'ram:GrandTotalAmount', SUMMATION)).toBe('711.62')
        // Nothing was paid on the credit note; the payment terms say how it is settled.
        expect(value(xml, 'ram:TotalPrepaidAmount', SUMMATION)).toBe('0.00')
        expect(value(xml, 'ram:DuePayableAmount', SUMMATION)).toBe('711.62')
        expect(xml).not.toContain('SpecifiedTradeSettlementPaymentMeans')
        expect(value(xml, 'ram:Description', 'ram:SpecifiedTradePaymentTerms')).toContain('PB-CON26-000')
        expect(xml).not.toMatch(/>-\d/)
    })

    test('a private buyer without address gets the documented country fallback', () => {
        const xml = buildFacturXXml(PRIVATE, SELLER)
        expect(value(xml, 'ram:Name', 'ram:BuyerTradeParty')).toBe('Erika Musterfrau')
        expect(value(xml, 'ram:CountryID', 'ram:BuyerTradeParty')).toBe('DE')
        expect(xml).not.toContain('<ram:AllowanceTotalAmount>')
        expect(xml).not.toContain('SpecifiedTradeAllowanceCharge')
        expect(buyerCountryCode(null)).toEqual({ code: 'DE', isFallback: true })
        expect(buyerCountryCode('Österreich')).toEqual({ code: 'AT', isFallback: false })
        expect(buyerCountryCode('AT')).toEqual({ code: 'AT', isFallback: false })
    })

    test('a 0 € invoice (100 % discount) has no payment means and zero totals', () => {
        const xml = buildFacturXXml(
            {
                ...PRIVATE,
                ticketType: 'Discounted',
                discountAmountCents: 39900,
                vatAmountCents: 0,
                totalGrossCents: 0,
            },
            SELLER
        )
        expect(value(xml, 'ram:TaxBasisTotalAmount', SUMMATION)).toBe('0.00')
        expect(value(xml, 'ram:GrandTotalAmount', SUMMATION)).toBe('0.00')
        expect(value(xml, 'ram:DuePayableAmount', SUMMATION)).toBe('0.00')
        expect(xml).not.toContain('SpecifiedTradeSettlementPaymentMeans')
    })

    test('escapes text and leaves a malformed buyer VAT ID out', () => {
        const xml = buildFacturXXml({ ...INVOICE, companyName: 'Müller & Söhne <GmbH>', companyVatId: '123' }, SELLER)
        expect(value(xml, 'ram:Name', 'ram:BuyerTradeParty')).toBe('Müller &amp; Söhne &lt;GmbH&gt;')
        expect(xml).not.toContain('schemeID="VA">123')
    })

    test('refuses data whose amounts do not reconcile with the printed totals', () => {
        expect(() => buildFacturXXml({ ...INVOICE, subtotalCents: 79801 }, SELLER)).toThrow(EInvoiceDataError)
        expect(() => buildFacturXXml({ ...INVOICE, totalGrossCents: 71163 }, SELLER)).toThrow(EInvoiceDataError)
        expect(() => buildFacturXXml({ ...INVOICE, invoiceDate: '2026-10-20' }, SELLER)).toThrow(EInvoiceDataError)
        // A VAT amount far off 19 % (more than BR-CO-17's tolerance of 1.00).
        expect(() => buildFacturXXml({ ...INVOICE, vatAmountCents: 11000, totalGrossCents: 70800 }, SELLER)).toThrow(
            EInvoiceDataError
        )
    })
})

describe('amount helpers', () => {
    test('the net unit price is the one the PDF always printed', () => {
        for (let gross = -50000; gross <= 200000; gross += 7) {
            expect(unitPriceNetCents({ unitPriceGrossCents: gross })).toBe(Math.round(gross / 1.19))
        }
    })

    test('per-ticket VAT rounding stays within a cent per two tickets of BR-CO-17', () => {
        // 3 × 99,99 € net: printed VAT 3 × 19,00 € = 57,00 €, exact 19 % of 299,97 € = 56,99 €.
        expect(3 * (Math.round(9999 * 1.19) - 9999)).toBe(5700)
        expect(expectedVatCents(29997)).toBe(5699)
        // Whole-euro prices never deviate.
        for (let net = 100; net <= 100000; net += 100) {
            for (let count = 1; count <= 10; count++) {
                expect(count * (Math.round(net * 1.19) - net)).toBe(expectedVatCents(count * net))
            }
        }
    })

    test('normalizeVatId', () => {
        expect(normalizeVatId('de 123.456.789')).toBe('DE123456789')
        expect(normalizeVatId('ATU12345678')).toBe('ATU12345678')
        expect(normalizeVatId('123456789')).toBeNull()
        expect(normalizeVatId(null)).toBeNull()
    })
})

describe('generateInvoicePdf e-invoice embedding', () => {
    test.each([
        ['invoice', INVOICE],
        ['correction', CORRECTION],
        ['cancellation', CANCELLATION],
    ] as const)('a %s embeds exactly the XML built from its data', async (_kind, data) => {
        const pdf = await generateInvoicePdf(data)

        expect(extractEmbeddedFile(pdf)).toBe(buildFacturXXml(data, SELLER))

        const fileSpec = embeddedFileSpec(pdf)
        expect(fileSpec).toContain('/AFRelationship /Alternative')
        expect(fileSpec).toContain('(factur-x.xml)')
        expect(pdf.toString('latin1')).toMatch(/\/AF \[\d+ 0 R\]/)
        expect(pdf.toString('latin1')).toContain('/Subtype /text#2Fxml')
        expect(pdf.toString('latin1')).toMatch(/^%PDF-1\.7/)
    })

    test('declares PDF/A-3b and the Factur-X EN 16931 profile in the XMP metadata', async () => {
        const xmp = pdfMetadata(await generateInvoicePdf(INVOICE))
        expect(xmp).toContain('<pdfaid:part>3</pdfaid:part>')
        expect(xmp).toContain('<pdfaid:conformance>B</pdfaid:conformance>')
        expect(xmp).toContain('<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#')
        expect(xmp).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>')
        expect(xmp).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>')
        expect(xmp).toContain('<fx:Version>1.0</fx:Version>')
        expect(xmp).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>')
    })

    test('rejects instead of rendering a PDF whose amounts the e-invoice would contradict', async () => {
        await expect(generateInvoicePdf({ ...INVOICE, subtotalCents: 1 })).rejects.toThrow(EInvoiceDataError)
    })
})
