import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Seller info (hardcoded)
const SELLER = {
    name: 'Lotum media GmbH',
    address: ['Am Goldstein 1', '61231 Bad Nauheim', 'Deutschland'],
    email: 'podcast@programmier.bar',
    phone: '+49 (0) 6032 925507 0',
    taxNumber: '020 238 63371',
    vatId: 'DE272856704',
}

// programmier.bar logo SVG paths (from pblogo.svg, viewBox 0 0 280 33)
const LOGO_PATHS = [
    // Black paths
    {
        fill: '#000',
        d: 'M43.96 6.7a9.4 9.4 0 0 0-9.64 9.61c0 5.5 4.04 9.5 9.64 9.5 5.62 0 9.67-4 9.67-9.5s-4.18-9.6-9.67-9.6m0 14.86c-2.82 0-4.9-2.16-4.9-5.26 0-3.13 2.05-5.36 4.9-5.36 2.84 0 4.94 2.26 4.94 5.36s-2.1 5.26-4.94 5.26m56.67-14.84c1.77 0 3.86.8 5.26 2V7.12h4.42v18.33h-4.42v-1.42c-1.42 1.48-3.36 1.81-5.26 1.81-5.6 0-9.64-4-9.64-9.5a9.4 9.4 0 0 1 9.64-9.6Zm-.16 4.25c-2.85 0-4.91 2.22-4.91 5.35 0 3.1 2.1 5.26 4.9 5.26 2.85 0 4.95-2.16 4.95-5.26s-2.1-5.35-4.94-5.35',
    },
    {
        fill: '#000',
        d: 'M65.27 6.78a8.4 8.4 0 0 1 5.15 1.97V7.1h4.35v17.58c0 .77 0 2.4-.44 3.66a6.3 6.3 0 0 1-2.4 2.98c-4.15 2.77-9.2 1.42-11.73.18.43-1.14.97-2.52 1.4-3.7 2.43 1.32 5.82 1.42 7.18.54s1.5-2.5 1.5-4.37v-.1c-1.38 1.32-3.21 1.63-5.01 1.63-5.49 0-9.46-3.93-9.46-9.32 0-5.42 4.1-9.41 9.46-9.41Zm-.16 4.16c-2.8 0-4.81 2.18-4.81 5.25 0 3.04 2.05 5.16 4.8 5.16 2.8 0 4.85-2.12 4.85-5.16 0-3.03-2.05-5.25-4.84-5.25m112.91-3.81v18.3h-4.4V7.13zm-2.2-7.11a2.68 2.68 0 0 1 2.67 2.7c0 1.5-1.2 2.7-2.66 2.7a2.68 2.68 0 0 1-2.67-2.7c0-1.5 1.2-2.7 2.67-2.7ZM9.68 6.74c5.5 0 9.7 4.1 9.7 9.6s-4.06 9.5-9.7 9.5c-1.98 0-3.76-.49-5.24-1.37V33H0V16.85h.01a9.42 9.42 0 0 1 9.67-10.1Zm0 4.24c-2.86 0-4.93 2.23-4.93 5.36 0 3.1 2.1 5.26 4.93 5.26 2.85 0 4.96-2.16 4.96-5.26s-2.1-5.36-4.96-5.36m180.73-4.2c5.16 0 7.93 3.8 7.93 8.6 0 .47-.08 1.45-.1 1.69v.05c-.03.35-.07.6-.11.73h-11.76c.56 2.69 2.43 4.07 4.89 4.07 2.87 0 5.25-1.72 5.25-1.72l.03.05 1.42 3.06c-.65.55-3.2 2.45-7.02 2.45-5.93 0-9.61-4.33-9.61-9.49 0-5.58 3.75-9.5 9.08-9.5Zm-.1 3.48c-2.16 0-3.6 1.53-3.85 3.77h7.35c-.08-2.27-1.64-3.77-3.5-3.77',
    },
    {
        fill: '#000',
        d: 'M26.3 14.35v11.03h-4.4V15.1c0-5.14 2.87-8.32 6.93-8.32 2.78 0 4.04 1.27 5.07 2.11a761 761 0 0 0-2.18 3c-.68-.64-1.38-.78-1.43-.8-.32-.11-.8-.1-.8-.1-1.6 0-3.19 1.35-3.19 3.36m56.58 0v11.03h-4.4V15.1c0-5.14 2.86-8.32 6.92-8.32 2.79 0 4.05 1.27 5.07 2.11a761 761 0 0 0-2.18 3c-.68-.64-1.37-.78-1.43-.8-.31-.11-.79-.1-.79-.1-1.6 0-3.2 1.35-3.2 3.36Zm123.02 0v11.03h-4.4V15.1c0-5.14 2.87-8.32 6.93-8.32 2.78 0 4.05 1.27 5.07 2.11a761 761 0 0 0-2.18 3c-.68-.64-1.38-.78-1.43-.8-.31-.11-.79-.1-.79-.1-1.6 0-3.2 1.35-3.2 3.36',
    },
    {
        fill: '#000',
        d: 'M126.84 8.92a7.1 7.1 0 0 0-5.2-2.2c-4.86 0-7.87 3.64-7.87 8.49v10.22h4.47V14.26c0-1.9 1.3-3.32 3.2-3.32 1.57 0 3 1.22 3 3.19v11.3h4.47V14.26a3.2 3.2 0 0 1 3.28-3.32 3.09 3.09 0 0 1 3.08 3.19v11.3h4.64V14.86c0-5.02-3.46-8.13-7.47-8.13-2.3 0-4.25.82-5.6 2.19m29.81 0a7.1 7.1 0 0 0-5.2-2.2c-4.87 0-7.88 3.64-7.88 8.49v10.22h4.47V14.26c0-1.9 1.3-3.32 3.2-3.32 1.57 0 3 1.22 3 3.19v11.3h4.47V14.26a3.2 3.2 0 0 1 3.28-3.32 3.09 3.09 0 0 1 3.08 3.19v11.3h4.64V14.86c0-5.02-3.46-8.13-7.47-8.13-2.3 0-4.25.82-5.6 2.19Z',
    },
    // Lime/green accent paths
    {
        fill: '#CFFF00',
        d: 'M254.44 6.73c1.77 0 3.87.8 5.26 2V7.12h4.43v18.33h-4.43v-1.42c-1.41 1.48-3.35 1.81-5.26 1.81-5.59 0-9.64-4-9.64-9.5a9.4 9.4 0 0 1 9.64-9.6Zm-.16 4.25c-2.85 0-4.9 2.22-4.9 5.35 0 3.1 2.09 5.26 4.9 5.26 2.85 0 4.94-2.16 4.94-5.26s-2.1-5.35-4.94-5.35',
    },
    {
        fill: '#CFFF00',
        d: 'M227.85 0v8.93c1.38-.8 3-1.25 4.77-1.25 5.2 0 9.18 3.9 9.18 9.11 0 5.22-3.84 9.02-9.18 9.02-5.3 0-9.15-3.8-9.15-9.02v-.09h-.01V0h4.4Zm4.77 11.7c-2.7 0-4.66 2.12-4.66 5.1 0 2.93 1.99 4.98 4.66 4.98 2.7 0 4.69-2.05 4.69-4.99s-1.99-5.08-4.7-5.08Z',
    },
    {
        fill: '#CFFF00',
        d: 'M272.4 14.35v11.03H268V15.1c0-5.14 2.87-8.32 6.93-8.32 2.79 0 4.05 1.27 5.07 2.11a761 761 0 0 0-2.18 3c-.68-.64-1.38-.78-1.43-.8-.31-.11-.79-.1-.79-.1-1.6 0-3.2 1.35-3.2 3.36',
    },
    // Lime dot
    {
        fill: '#CFFF00',
        d: 'M215.48 23.54a2.2 2.2 0 0 1 2.2-2.23 2.2 2.2 0 0 1 2.2 2.23 2.2 2.2 0 0 1-2.2 2.23 2.2 2.2 0 0 1-2.2-2.23Z',
    },
]

export interface InvoiceData {
    invoiceNumber: string
    invoiceDate: string // formatted DD.MM.YYYY
    // Customer
    purchaserName: string
    purchaserEmail: string
    companyName: string | null
    companyVatId: string | null
    billingAddressLine1: string | null
    billingAddressLine2: string | null
    billingCity: string | null
    billingPostalCode: string | null
    billingCountry: string | null
    // Line items
    conferenceTitle: string
    ticketType: string // 'Early Bird', 'Regular', 'Discounted'
    ticketCount: number
    unitPriceGrossCents: number // per-ticket gross price
    // Totals
    subtotalCents: number // net total
    discountAmountCents: number
    vatAmountCents: number
    totalGrossCents: number
}

function formatEur(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100)
}

function tryLoadMuseoFont(): Buffer | null {
    try {
        const distDir = path.dirname(fileURLToPath(import.meta.url))
        const fontPath = path.resolve(distDir, '..', 'assets', 'MuseoSans700.otf')
        return fs.readFileSync(fontPath)
    } catch {
        return null
    }
}

function drawLogo(doc: InstanceType<typeof PDFDocument>, x: number, y: number, scale: number) {
    for (const { fill, d } of LOGO_PATHS) {
        doc.save()
        doc.translate(x, y)
        doc.scale(scale)
        doc.path(d).fill(fill)
        doc.restore()
    }
}

/**
 * Generate an invoice PDF and return it as a Buffer.
 */
export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Try to load Museo Sans font
        const museoFont = tryLoadMuseoFont()
        if (museoFont) {
            doc.registerFont('MuseoSans', museoFont)
            doc.font('MuseoSans')
        }

        const pageWidth = doc.page.width - 100 // margins

        // --- Header with logo ---
        drawLogo(doc, 50, 50, 0.55)

        doc.fontSize(18).fillColor('#000')
        doc.text(`Rechnung Nr.: ${data.invoiceNumber}`, 50, 50, { align: 'right' })

        doc.fontSize(9).fillColor('#666')
        doc.text(`Rechnungsdatum: ${data.invoiceDate}`, 50, 75, { align: 'right' })
        doc.text(`Fälligkeitsdatum: ${data.invoiceDate}`, 50, 87, { align: 'right' })

        // --- Seller info ---
        let y = 115
        doc.fontSize(9).fillColor('#333')
        doc.text(SELLER.name, 50, y)
        y += 13
        for (const line of SELLER.address) {
            doc.text(line, 50, y)
            y += 12
        }
        y += 4
        doc.text(SELLER.email, 50, y)
        y += 12
        doc.text(`Telefonnummer: ${SELLER.phone}`, 50, y)
        y += 12
        doc.text(`Steuernummer: ${SELLER.taxNumber}`, 50, y)
        doc.text(`Umsatzsteuer-ID: ${SELLER.vatId}`, 300, y)

        // --- Separator ---
        y += 20
        doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#ccc').stroke()

        // --- Customer info ---
        y += 12
        doc.fontSize(9).fillColor('#666')
        doc.text('Kundendetails:', 50, y)
        y += 14
        doc.fontSize(10).fillColor('#000')
        doc.text(data.purchaserName, 50, y)
        y += 13
        doc.fontSize(9).fillColor('#333')
        doc.text(data.purchaserEmail, 50, y)
        y += 14

        if (data.companyName) {
            doc.text(data.companyName, 50, y)
            y += 12
        }
        if (data.billingAddressLine1) {
            doc.text(data.billingAddressLine1, 50, y)
            y += 12
        }
        if (data.billingAddressLine2) {
            doc.text(data.billingAddressLine2, 50, y)
            y += 12
        }
        if (data.billingPostalCode || data.billingCity) {
            doc.text(`${data.billingPostalCode || ''} ${data.billingCity || ''}`.trim(), 50, y)
            y += 12
        }
        if (data.billingCountry) {
            doc.text(data.billingCountry, 50, y)
            y += 12
        }
        if (data.companyVatId) {
            y += 4
            doc.text(`Umsatzsteuer-ID: ${data.companyVatId}`, 50, y)
            y += 12
        }

        // --- Separator ---
        y += 10
        doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#ccc').stroke()

        // --- Line items table ---
        y += 14

        // Table header
        const col1 = 50
        const col2 = 290
        const col3 = 380
        const col4 = 470

        doc.fontSize(9).fillColor('#334155')
        doc.rect(50, y - 4, pageWidth, 20).fill('#f1f5f9')
        doc.fillColor('#334155')
        doc.text('Ticket-Art', col1, y, { width: 230 })
        doc.text('Anzahl', col2, y, { width: 60, align: 'center' })
        doc.text('Einzelpreis', col3, y, { width: 80, align: 'right' })
        doc.text('Gesamtpreis', col4, y, { width: 75, align: 'right' })

        y += 22

        // Line item – use netto (net) prices
        const unitPriceNetCents = Math.round(data.unitPriceGrossCents / 1.19)
        doc.fontSize(9).fillColor('#000')
        const ticketLabel = `${data.ticketType}\n${data.conferenceTitle}`
        doc.text(ticketLabel, col1, y, { width: 230 })
        doc.text(String(data.ticketCount), col2, y, { width: 60, align: 'center' })
        doc.text(formatEur(unitPriceNetCents), col3, y, { width: 80, align: 'right' })
        doc.text(formatEur(unitPriceNetCents * data.ticketCount), col4, y, { width: 75, align: 'right' })

        y += 35

        // --- Separator ---
        doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#ccc').stroke()
        y += 14

        // --- Totals ---
        const labelX = 280
        const valueX = 470
        const valueW = 75

        doc.fontSize(10).fillColor('#000')
        doc.text('Zwischensumme', labelX, y)
        doc.text(formatEur(data.subtotalCents), valueX, y, { width: valueW, align: 'right' })
        y += 20

        if (data.discountAmountCents > 0) {
            doc.fontSize(9).fillColor('#666')
            doc.text('Rabatt', labelX + 20, y)
            doc.text(`-${formatEur(data.discountAmountCents)}`, valueX, y, { width: valueW, align: 'right' })
            y += 16
        }

        doc.fontSize(10).fillColor('#000')
        doc.text('Steueraufschlüsselung', labelX, y)
        y += 18
        doc.fontSize(9).fillColor('#666')
        doc.text('MwSt. (19 %)', labelX + 20, y)
        doc.text(formatEur(data.vatAmountCents), valueX, y, { width: valueW, align: 'right' })
        y += 16
        doc.text('Steuersumme', labelX + 20, y)
        doc.text(formatEur(data.vatAmountCents), valueX, y, { width: valueW, align: 'right' })

        y += 24
        doc.moveTo(280, y).lineTo(50 + pageWidth, y).strokeColor('#ccc').stroke()
        y += 14

        doc.fontSize(10).fillColor('#000')
        doc.text('Rechnungsbetrag', labelX, y)
        doc.text(formatEur(data.totalGrossCents), valueX, y, { width: valueW, align: 'right' })
        y += 18
        doc.text('Bezahlter Betrag', labelX, y)
        doc.text(formatEur(data.totalGrossCents), valueX, y, { width: valueW, align: 'right' })

        y += 24
        doc.rect(280, y - 4, pageWidth - 230, 22).fill('#f0fdf4')
        doc.fontSize(10).fillColor('#16a34a')
        doc.text('Offener Betrag', labelX, y)
        doc.text(formatEur(0), valueX, y, { width: valueW, align: 'right' })

        // Finalize
        doc.end()
    })
}

/**
 * Generate the next invoice number for a conference.
 * Pattern: PB-CON{YY}-{NNN}
 */
export async function generateInvoiceNumber(
    ordersService: any,
    conferenceYear: number
): Promise<string> {
    const yy = String(conferenceYear).slice(-2)
    const prefix = `PB-CON${yy}-`

    // Find the highest existing invoice number with this prefix
    const existingOrders = await ordersService.readByQuery({
        filter: {
            invoice_number: { _starts_with: prefix },
        },
        fields: ['invoice_number'],
        sort: ['-invoice_number'],
        limit: 1,
    })

    let nextNum = 1
    if (existingOrders && existingOrders.length > 0 && existingOrders[0].invoice_number) {
        const existing = existingOrders[0].invoice_number as string
        const numPart = existing.replace(prefix, '')
        const parsed = parseInt(numPart, 10)
        if (!isNaN(parsed)) {
            nextNum = parsed + 1
        }
    }

    return `${prefix}${String(nextNum).padStart(3, '0')}`
}

/**
 * Map ticket type to German display label.
 */
export function ticketTypeLabel(type: string): string {
    switch (type) {
        case 'early_bird':
            return 'Early Bird'
        case 'regular':
            return 'Regular'
        case 'discounted':
            return 'Discounted'
        default:
            return type
    }
}
