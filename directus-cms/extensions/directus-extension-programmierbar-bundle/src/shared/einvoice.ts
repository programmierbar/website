import { normalizeBillingCountry } from '../../../../../shared-code/index.ts'
import type { InvoiceData, InvoiceDocumentKind } from './invoice-generator.js'

/**
 * ZUGFeRD 2.x / Factur-X e-invoice (profile EN 16931, "COMFORT") for ticket invoices.
 *
 * The CII XML is built from the very same `InvoiceData` the PDF is rendered from, and
 * every amount in it is one of the printed amounts — nothing is recomputed, so the
 * XML cannot drift from the PDF. `generateInvoicePdf` embeds it as `factur-x.xml`
 * into a PDF/A-3b, so one file is both the readable invoice and a valid German
 * E-Rechnung (§ 14 UStG).
 *
 * When the data cannot yield a correct e-invoice (see {@link EInvoiceDataError}), the
 * document is issued as a plain PDF without XML instead: false XML data is worse than
 * none, and issuing an invoice must never be blocked by its e-invoice.
 */

/** Only VAT rate ticket invoices use (Umsatzsteuer, standard rate). */
export const VAT_RATE_PERCENT = 19

/** File name of the embedded XML mandated by Factur-X 1.0 / ZUGFeRD 2.1+. */
export const FACTURX_FILENAME = 'factur-x.xml'

/** EN 16931 profile ("COMFORT" in ZUGFeRD terms). */
export const FACTURX_GUIDELINE_ID = 'urn:cen.eu:en16931:2017'
export const FACTURX_CONFORMANCE_LEVEL = 'EN 16931'
export const FACTURX_VERSION = '1.0'

/**
 * BT-3 invoice type codes (UNTDID 1001):
 * - 380 commercial invoice — Rechnung
 * - 384 corrected invoice — Rechnungsberichtigung (replaces the referenced invoice)
 * - 381 credit note — Stornorechnung. Carries POSITIVE amounts: a credit note over
 *   +X is the e-invoice equivalent of the printed storno over −X. This is how German
 *   e-invoicing software usually transmits a Storno; 389 (self-billed invoice) would be
 *   the UStG "Gutschrift", which a Storno is not.
 */
export const INVOICE_TYPE_CODES: Record<InvoiceDocumentKind, string> = {
    invoice: '380',
    correction: '384',
    cancellation: '381',
}

/** Seller block printed on the PDF and mapped to BG-4 in the XML. */
export interface InvoiceSeller {
    name: string
    street: string
    postalCode: string
    city: string
    /** ISO 3166-1 alpha-2. */
    countryCode: string
    countryName: string
    email: string
    phone: string
    /** Steuernummer (BT-32). */
    taxNumber: string
    /** USt-IdNr. (BT-31). */
    vatId: string
}

/**
 * Thrown when the invoice data would yield an e-invoice that contradicts the printed
 * amounts or violates EN 16931 — e.g. hand-edited amounts, or a discount code priced
 * above the list price (a negative Rabatt). `generateInvoicePdf` then leaves the XML
 * out instead of embedding false data.
 */
export class EInvoiceDataError extends Error {
    constructor(invoiceNumber: string, reason: string) {
        super(`Cannot build the e-invoice for ${invoiceNumber}: ${reason}`)
        this.name = 'EInvoiceDataError'
    }
}

/**
 * The buyer country (BT-55) is unknown, so no EN 16931 e-invoice can be built (BR-11).
 * Expected for private buyers, who may skip the address — and need no E-Rechnung.
 */
export class MissingBuyerCountryError extends EInvoiceDataError {
    constructor(invoiceNumber: string, billingCountry: string | null | undefined) {
        super(invoiceNumber, `the billing country "${billingCountry ?? ''}" has no ISO code (BT-55, BR-11)`)
        this.name = 'MissingBuyerCountryError'
    }
}

/**
 * Net unit price printed in the line item table. The snapshot stores the gross price
 * per ticket; the net price is derived from it exactly like the PDF always did.
 */
export function unitPriceNetCents(data: Pick<InvoiceData, 'unitPriceGrossCents'>): number {
    return Math.round((data.unitPriceGrossCents * 100) / (100 + VAT_RATE_PERCENT))
}

/** The printed amounts of an invoice, in cents and with the printed signs. */
export interface InvoiceAmounts {
    unitNetCents: number
    lineNetCents: number
    discountCents: number
    taxBasisCents: number
    vatCents: number
    totalGrossCents: number
}

/** Amounts as printed on the PDF: a Stornorechnung carries them negated. */
export function printedInvoiceAmounts(data: InvoiceData): InvoiceAmounts {
    const unitNetCents = unitPriceNetCents(data)
    const lineNetCents = unitNetCents * data.ticketCount
    return {
        unitNetCents,
        lineNetCents,
        discountCents: data.discountAmountCents,
        taxBasisCents: lineNetCents - data.discountAmountCents,
        vatCents: data.vatAmountCents,
        totalGrossCents: data.totalGrossCents,
    }
}

/**
 * VAT amount EN 16931 BR-CO-17 expects for a taxable amount: taxable × 19 %, rounded
 * to the cent. The printed VAT is the sum of per-ticket VAT (gross per ticket is
 * rounded first, see the checkout), which may differ from this by up to half a cent
 * per ticket. The official CII schematron accepts a deviation of up to 1.00.
 */
export function expectedVatCents(taxBasisCents: number): number {
    const sign = taxBasisCents < 0 ? -1 : 1
    return sign * Math.round((Math.abs(taxBasisCents) * VAT_RATE_PERCENT) / 100)
}

/** Largest deviation from BR-CO-17 the EN 16931 CII schematron tolerates (in cents). */
const BR_CO_17_TOLERANCE_CENTS = 100

function formatAmount(cents: number): string {
    const sign = cents < 0 ? '-' : ''
    const abs = Math.abs(cents)
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

function escapeXml(value: string): string {
    return (
        value
            // Characters XML 1.0 cannot represent at all.
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    )
}

/** "DD.MM.YYYY" (as printed) → "YYYYMMDD" (UNTDID 2379 format 102). */
function toFormat102(invoiceNumber: string, printedDate: string): string {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(printedDate)
    if (!match) {
        throw new EInvoiceDataError(invoiceNumber, `unexpected date format "${printedDate}"`)
    }
    return `${match[3]}${match[2]}${match[1]}`
}

/** "YYYY-MM-DD" → "YYYYMMDD", or null. */
function isoToFormat102(value: string | null | undefined): string | null {
    const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
    return match ? `${match[1]}${match[2]}${match[3]}` : null
}

function dateElement(tag: string, yyyymmdd: string): string {
    return `<${tag}><udt:DateTimeString format="102">${yyyymmdd}</udt:DateTimeString></${tag}>`
}

/**
 * Prefixes BR-CO-09 accepts for a VAT identifier: ISO 3166-1 alpha-2 plus EL (Greece)
 * and the codes 1A and XI — copied from the EN 16931 CII schematron.
 */
const VAT_ID_PREFIXES = new Set(
    (
        '1A AD AE AF AG AI AL AM AN AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BL BJ BM BN BO BQ BR BS BT BV ' +
        'BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH EL ER ES ET ' +
        'FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN ' +
        'IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF ' +
        'MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH ' +
        'PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR ST SV SX SY SZ TC ' +
        'TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XI YE YT ZA ZM ZW'
    ).split(' ')
)

/**
 * BT-48 must start with a country prefix BR-CO-09 accepts. The checkout takes the
 * USt-IdNr. as free text, so an unprefixed or malformed value is left out of the XML
 * (it is optional for a domestic 19 % invoice) — the PDF still prints it as entered.
 */
export function normalizeVatId(value: string | null | undefined): string | null {
    const compact = (value ?? '').replace(/[\s.\-/]/g, '').toUpperCase()
    return /^[A-Z0-9]{2}[0-9A-Z+*]{2,12}$/.test(compact) && VAT_ID_PREFIXES.has(compact.slice(0, 2)) ? compact : null
}

/** BT-55: ISO code of the buyer's country, or null when the order has none we can map. */
export function buyerCountryCode(billingCountry: string | null | undefined): string | null {
    return normalizeBillingCountry(billingCountry) ?? null
}

/** Number and printed date of the corrected/cancelled invoice (BT-25/BT-26). */
function precedingInvoiceOf(data: InvoiceData): { number: string; date: string } | null {
    if (data.documentKind === 'correction' || data.documentKind === 'cancellation') {
        return data.referenceNumber && data.referenceDate
            ? { number: data.referenceNumber, date: data.referenceDate }
            : null
    }
    return null
}

/**
 * Build the Factur-X / ZUGFeRD CII XML (profile EN 16931) for an invoice.
 *
 * Amount mapping (all values are the printed ones):
 * - one line per ticket type: quantity = ticket count, net price = printed Einzelpreis,
 *   line net amount = printed Gesamtpreis
 * - the printed "Rabatt" line becomes a document-level allowance (BG-20)
 * - VAT (BT-110/BT-117) = printed MwSt., grand total (BT-112) = printed Rechnungsbetrag
 * - invoices and corrections were paid upfront: paid amount (BT-113) = total, due 0
 * - a Stornorechnung is a credit note (381) carrying the printed amounts with the sign
 *   flipped back to positive.
 */
export function buildFacturXXml(data: InvoiceData, seller: InvoiceSeller): string {
    const kind: InvoiceDocumentKind = data.documentKind || 'invoice'
    const invoiceNumber = data.invoiceNumber

    // A Stornorechnung prints negated amounts; the credit note carries them positive.
    const sign = kind === 'cancellation' ? -1 : 1
    const printed = printedInvoiceAmounts(data)
    const amounts: InvoiceAmounts = {
        unitNetCents: sign * printed.unitNetCents,
        lineNetCents: sign * printed.lineNetCents,
        discountCents: sign * printed.discountCents,
        taxBasisCents: sign * printed.taxBasisCents,
        vatCents: sign * printed.vatCents,
        totalGrossCents: sign * printed.totalGrossCents,
    }

    if (!Number.isInteger(data.ticketCount) || data.ticketCount <= 0) {
        throw new EInvoiceDataError(invoiceNumber, `invalid ticket count ${data.ticketCount}`)
    }
    if (amounts.unitNetCents < 0 || amounts.discountCents < 0 || amounts.totalGrossCents < 0) {
        throw new EInvoiceDataError(invoiceNumber, `unexpected negative amounts for a ${kind} document`)
    }
    // The printed line total must be the printed Zwischensumme ...
    if (printed.lineNetCents !== data.subtotalCents) {
        throw new EInvoiceDataError(
            invoiceNumber,
            `line total ${printed.lineNetCents} (unit net × count) does not match the subtotal ${data.subtotalCents}`
        )
    }
    // ... and Zwischensumme − Rabatt + MwSt. must be the printed Rechnungsbetrag.
    if (amounts.taxBasisCents + amounts.vatCents !== amounts.totalGrossCents) {
        throw new EInvoiceDataError(
            invoiceNumber,
            `net ${amounts.taxBasisCents} + VAT ${amounts.vatCents} does not add up to the total ${amounts.totalGrossCents}`
        )
    }
    if (Math.abs(amounts.vatCents - expectedVatCents(amounts.taxBasisCents)) > BR_CO_17_TOLERANCE_CENTS) {
        throw new EInvoiceDataError(
            invoiceNumber,
            `VAT ${amounts.vatCents} deviates too far from ${VAT_RATE_PERCENT} % of ${amounts.taxBasisCents} (BR-CO-17)`
        )
    }
    const preceding = precedingInvoiceOf(data)
    if (kind !== 'invoice' && !preceding) {
        throw new EInvoiceDataError(invoiceNumber, 'missing reference to the corrected/cancelled invoice')
    }
    const issueDate = toFormat102(invoiceNumber, data.invoiceDate)
    // Last check, so a MissingBuyerCountryError means everything else is fine.
    const buyerCountry = buyerCountryCode(data.billingCountry)
    if (!buyerCountry) {
        throw new MissingBuyerCountryError(invoiceNumber, data.billingCountry)
    }

    const amount = (cents: number) => formatAmount(cents)
    const text = (value: string) => escapeXml(value)
    const vatCategory = `<ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${VAT_RATE_PERCENT}</ram:RateApplicablePercent>`

    // --- Notes (BT-22) ---
    // Same sentence the PDF prints for a correction/cancellation.
    const notes: string[] = []
    if (preceding && kind === 'correction') {
        notes.push(
            `Diese Rechnungsberichtigung berichtigt und ersetzt die Rechnung Nr. ${preceding.number} vom ${preceding.date}.`
        )
    } else if (preceding && kind === 'cancellation') {
        notes.push(`Diese Stornorechnung storniert die Rechnung Nr. ${preceding.number} vom ${preceding.date}.`)
    }

    // --- Seller (BG-4) ---
    const sellerParty = [
        `<ram:Name>${text(seller.name)}</ram:Name>`,
        '<ram:DefinedTradeContact>',
        `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${text(seller.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>`,
        `<ram:EmailURIUniversalCommunication><ram:URIID>${text(seller.email)}</ram:URIID></ram:EmailURIUniversalCommunication>`,
        '</ram:DefinedTradeContact>',
        '<ram:PostalTradeAddress>',
        `<ram:PostcodeCode>${text(seller.postalCode)}</ram:PostcodeCode>`,
        `<ram:LineOne>${text(seller.street)}</ram:LineOne>`,
        `<ram:CityName>${text(seller.city)}</ram:CityName>`,
        `<ram:CountryID>${seller.countryCode}</ram:CountryID>`,
        '</ram:PostalTradeAddress>',
        `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${text(seller.email)}</ram:URIID></ram:URIUniversalCommunication>`,
        `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${text(seller.taxNumber)}</ram:ID></ram:SpecifiedTaxRegistration>`,
        `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${text(seller.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`,
    ]

    // --- Buyer (BG-7) ---
    const companyName = data.companyName?.trim() || null
    const buyerVatId = normalizeVatId(data.companyVatId)
    const buyerParty = [`<ram:Name>${text(companyName || data.purchaserName)}</ram:Name>`]
    if (companyName) {
        buyerParty.push(
            '<ram:DefinedTradeContact>',
            `<ram:PersonName>${text(data.purchaserName)}</ram:PersonName>`,
            `<ram:EmailURIUniversalCommunication><ram:URIID>${text(data.purchaserEmail)}</ram:URIID></ram:EmailURIUniversalCommunication>`,
            '</ram:DefinedTradeContact>'
        )
    }
    buyerParty.push('<ram:PostalTradeAddress>')
    if (data.billingPostalCode?.trim()) {
        buyerParty.push(`<ram:PostcodeCode>${text(data.billingPostalCode.trim())}</ram:PostcodeCode>`)
    }
    if (data.billingAddressLine1?.trim()) {
        buyerParty.push(`<ram:LineOne>${text(data.billingAddressLine1.trim())}</ram:LineOne>`)
    }
    if (data.billingAddressLine2?.trim()) {
        buyerParty.push(`<ram:LineTwo>${text(data.billingAddressLine2.trim())}</ram:LineTwo>`)
    }
    if (data.billingCity?.trim()) {
        buyerParty.push(`<ram:CityName>${text(data.billingCity.trim())}</ram:CityName>`)
    }
    buyerParty.push(`<ram:CountryID>${buyerCountry}</ram:CountryID>`, '</ram:PostalTradeAddress>')
    if (data.purchaserEmail?.trim()) {
        buyerParty.push(
            `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${text(data.purchaserEmail.trim())}</ram:URIID></ram:URIUniversalCommunication>`
        )
    }
    if (buyerVatId) {
        buyerParty.push(
            `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${buyerVatId}</ram:ID></ram:SpecifiedTaxRegistration>`
        )
    }

    // --- Leistungsdatum: BT-72 for a single day, BG-14 for a multi-day conference ---
    const serviceStart = isoToFormat102(data.servicePeriodStart) ?? isoToFormat102(data.servicePeriodEnd)
    const serviceEnd = isoToFormat102(data.servicePeriodEnd)
    const isServicePeriod = !!serviceStart && !!serviceEnd && serviceEnd > serviceStart
    const delivery =
        serviceStart && !isServicePeriod
            ? `<ram:ActualDeliverySupplyChainEvent>${dateElement('ram:OccurrenceDateTime', serviceStart)}</ram:ActualDeliverySupplyChainEvent>`
            : ''
    const billingPeriod =
        isServicePeriod && serviceStart && serviceEnd
            ? `<ram:BillingSpecifiedPeriod>${dateElement('ram:StartDateTime', serviceStart)}${dateElement('ram:EndDateTime', serviceEnd)}</ram:BillingSpecifiedPeriod>`
            : ''

    // --- Payment (BG-16, BT-20, BT-113, BT-115) ---
    const isCreditNote = kind === 'cancellation'
    const paidCents = isCreditNote ? 0 : amounts.totalGrossCents
    const dueCents = amounts.totalGrossCents - paidCents
    const paymentMeans =
        !isCreditNote && amounts.totalGrossCents > 0
            ? '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>68</ram:TypeCode><ram:Information>Online-Zahlung bei der Bestellung (bereits bezahlt)</ram:Information></ram:SpecifiedTradeSettlementPaymentMeans>'
            : ''
    const paymentTerms = isCreditNote
        ? `<ram:SpecifiedTradePaymentTerms><ram:Description>${text(`Storno der Rechnung Nr. ${preceding?.number} vom ${preceding?.date}. Eine Erstattung bereits gezahlter Beträge erfolgt gesondert.`)}</ram:Description></ram:SpecifiedTradePaymentTerms>`
        : `<ram:SpecifiedTradePaymentTerms><ram:Description>Der Rechnungsbetrag wurde bereits vollständig bezahlt.</ram:Description>${kind === 'invoice' ? dateElement('ram:DueDateDateTime', issueDate) : ''}</ram:SpecifiedTradePaymentTerms>`

    const allowance =
        amounts.discountCents !== 0
            ? [
                  '<ram:SpecifiedTradeAllowanceCharge>',
                  '<ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>',
                  `<ram:ActualAmount>${amount(amounts.discountCents)}</ram:ActualAmount>`,
                  '<ram:ReasonCode>95</ram:ReasonCode>',
                  '<ram:Reason>Rabatt</ram:Reason>',
                  `<ram:CategoryTradeTax>${vatCategory}</ram:CategoryTradeTax>`,
                  '</ram:SpecifiedTradeAllowanceCharge>',
              ].join('')
            : ''

    const precedingInvoice = preceding
        ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${text(preceding.number)}</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${toFormat102(invoiceNumber, preceding.date)}</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>`
        : ''

    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
        '<rsm:ExchangedDocumentContext>',
        `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${FACTURX_GUIDELINE_ID}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>`,
        '</rsm:ExchangedDocumentContext>',
        '<rsm:ExchangedDocument>',
        `<ram:ID>${text(invoiceNumber)}</ram:ID>`,
        `<ram:TypeCode>${INVOICE_TYPE_CODES[kind]}</ram:TypeCode>`,
        dateElement('ram:IssueDateTime', issueDate),
        ...notes.map((note) => `<ram:IncludedNote><ram:Content>${text(note)}</ram:Content></ram:IncludedNote>`),
        '</rsm:ExchangedDocument>',
        '<rsm:SupplyChainTradeTransaction>',
        '<ram:IncludedSupplyChainTradeLineItem>',
        '<ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>',
        `<ram:SpecifiedTradeProduct><ram:Name>${text(`${data.conferenceTitle} – Ticket ${data.ticketType}`)}</ram:Name></ram:SpecifiedTradeProduct>`,
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amount(amounts.unitNetCents)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>`,
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${data.ticketCount}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`,
        '<ram:SpecifiedLineTradeSettlement>',
        `<ram:ApplicableTradeTax>${vatCategory}</ram:ApplicableTradeTax>`,
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(amounts.lineNetCents)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>`,
        '</ram:SpecifiedLineTradeSettlement>',
        '</ram:IncludedSupplyChainTradeLineItem>',
        '<ram:ApplicableHeaderTradeAgreement>',
        '<ram:SellerTradeParty>',
        ...sellerParty,
        '</ram:SellerTradeParty>',
        '<ram:BuyerTradeParty>',
        ...buyerParty,
        '</ram:BuyerTradeParty>',
        '</ram:ApplicableHeaderTradeAgreement>',
        `<ram:ApplicableHeaderTradeDelivery>${delivery}</ram:ApplicableHeaderTradeDelivery>`,
        '<ram:ApplicableHeaderTradeSettlement>',
        '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>',
        paymentMeans,
        '<ram:ApplicableTradeTax>',
        `<ram:CalculatedAmount>${amount(amounts.vatCents)}</ram:CalculatedAmount>`,
        '<ram:TypeCode>VAT</ram:TypeCode>',
        `<ram:BasisAmount>${amount(amounts.taxBasisCents)}</ram:BasisAmount>`,
        '<ram:CategoryCode>S</ram:CategoryCode>',
        `<ram:RateApplicablePercent>${VAT_RATE_PERCENT}</ram:RateApplicablePercent>`,
        '</ram:ApplicableTradeTax>',
        billingPeriod,
        allowance,
        paymentTerms,
        '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
        `<ram:LineTotalAmount>${amount(amounts.lineNetCents)}</ram:LineTotalAmount>`,
        amounts.discountCents !== 0
            ? `<ram:AllowanceTotalAmount>${amount(amounts.discountCents)}</ram:AllowanceTotalAmount>`
            : '',
        `<ram:TaxBasisTotalAmount>${amount(amounts.taxBasisCents)}</ram:TaxBasisTotalAmount>`,
        `<ram:TaxTotalAmount currencyID="EUR">${amount(amounts.vatCents)}</ram:TaxTotalAmount>`,
        `<ram:GrandTotalAmount>${amount(amounts.totalGrossCents)}</ram:GrandTotalAmount>`,
        `<ram:TotalPrepaidAmount>${amount(paidCents)}</ram:TotalPrepaidAmount>`,
        `<ram:DuePayableAmount>${amount(dueCents)}</ram:DuePayableAmount>`,
        '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
        precedingInvoice,
        '</ram:ApplicableHeaderTradeSettlement>',
        '</rsm:SupplyChainTradeTransaction>',
        '</rsm:CrossIndustryInvoice>',
    ]

    return lines.filter((line) => line !== '').join('\n') + '\n'
}

/**
 * XMP packet content PDF/A-3 + Factur-X require: the PDF/A extension schema
 * describing the `fx` properties, and the properties themselves.
 */
export function facturXXmpMetadata(): string {
    const property = (name: string, description: string) =>
        `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`
    return [
        '<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">',
        '<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">',
        '<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>',
        '<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>',
        '<pdfaSchema:prefix>fx</pdfaSchema:prefix>',
        '<pdfaSchema:property><rdf:Seq>',
        property('DocumentFileName', 'name of the embedded XML invoice file'),
        property('DocumentType', 'INVOICE'),
        property('Version', 'The actual version of the Factur-X XML schema'),
        property('ConformanceLevel', 'The conformance level of the embedded Factur-X data'),
        '</rdf:Seq></pdfaSchema:property>',
        '</rdf:li></rdf:Bag></pdfaExtension:schemas>',
        '</rdf:Description>',
        '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">',
        '<fx:DocumentType>INVOICE</fx:DocumentType>',
        `<fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName>`,
        `<fx:Version>${FACTURX_VERSION}</fx:Version>`,
        `<fx:ConformanceLevel>${FACTURX_CONFORMANCE_LEVEL}</fx:ConformanceLevel>`,
        '</rdf:Description>',
    ].join('\n')
}
