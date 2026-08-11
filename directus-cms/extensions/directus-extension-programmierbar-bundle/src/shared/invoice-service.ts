import { Readable } from 'node:stream'
import { generateInvoicePdf, ticketTypeLabel, type InvoiceData } from './invoice-generator.js'

/** Order fields required to assemble an invoice (subset of `ticket_orders`). */
export interface InvoiceOrder {
    id: string | number
    purchaser_first_name: string
    purchaser_last_name: string
    purchaser_email: string
    company_name: string | null
    company_vat_id: string | null
    billing_address_line1: string | null
    billing_address_line2: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_country: string | null
    subtotal_cents: number | null
    discount_amount_cents: number | null
    total_cents: number | null
    total_gross_cents: number | null
    vat_amount_cents: number | null
    ticket_type: string
}

export interface CreateInvoiceParams {
    order: InvoiceOrder
    conferenceTitle: string
    ticketCount: number
    invoiceNumber: string
    invoiceDate: Date
    ordersService: any
    filesService: any
    storageLocation?: string
}

export interface CreateInvoiceResult {
    fileId: string
    pdfBuffer: Buffer
    invoiceFileName: string
}

/**
 * Assemble the invoice data for an order, render the PDF, upload it to Directus files,
 * and write `invoice_number` / `invoice_file` onto the order.
 *
 * Used both for the initial invoice (on payment) and for regeneration, so the caller
 * decides which invoice number and date to use.
 */
export async function createAndStoreInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
    const { order, conferenceTitle, ticketCount, invoiceNumber, invoiceDate, ordersService, filesService } = params

    const formattedInvoiceDate = invoiceDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })

    // Derive per-ticket price from the pre-discount subtotal so the line item reconciles with Zwischensumme; the Rabatt line takes us down to the actual total.
    const subtotalCents = order.subtotal_cents || order.total_cents || 0
    const baseUnitNetCents = Math.round(subtotalCents / ticketCount)
    const grossPerTicket = Math.round(baseUnitNetCents * 1.19)

    const invoiceData: InvoiceData = {
        invoiceNumber,
        invoiceDate: formattedInvoiceDate,
        purchaserName: `${order.purchaser_first_name} ${order.purchaser_last_name}`,
        purchaserEmail: order.purchaser_email,
        companyName: order.company_name,
        companyVatId: order.company_vat_id,
        billingAddressLine1: order.billing_address_line1,
        billingAddressLine2: order.billing_address_line2,
        billingCity: order.billing_city,
        billingPostalCode: order.billing_postal_code,
        billingCountry: order.billing_country,
        conferenceTitle,
        ticketType: ticketTypeLabel(order.ticket_type),
        ticketCount,
        unitPriceGrossCents: grossPerTicket,
        subtotalCents: (order.subtotal_cents || order.total_cents) as number,
        discountAmountCents: order.discount_amount_cents || 0,
        vatAmountCents: order.vat_amount_cents || 0,
        totalGrossCents: (order.total_gross_cents || order.total_cents) as number,
    }

    const pdfBuffer = await generateInvoicePdf(invoiceData)

    const invoiceFileName = `Rechnung-${invoiceNumber}.pdf`
    const pdfStream = Readable.from([pdfBuffer])
    const fileId = await filesService.uploadOne(pdfStream, {
        type: 'application/pdf',
        filename_download: invoiceFileName,
        title: `Rechnung ${invoiceNumber}`,
        ...(params.storageLocation && { storage: params.storageLocation }),
    })

    // Update order with invoice number and file reference
    await ordersService.updateOne(order.id, {
        invoice_number: invoiceNumber,
        invoice_file: fileId,
    })

    return { fileId, pdfBuffer, invoiceFileName }
}
