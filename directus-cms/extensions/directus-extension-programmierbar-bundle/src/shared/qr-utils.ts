import QRCode from 'qrcode'

/**
 * Generate a unique ticket code
 */
export function generateTicketCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoiding ambiguous chars
    let code = 'TKT-'
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

/**
 * Generate a unique ticket code with retry logic to avoid collisions
 */
export async function generateUniqueTicketCode(ticketsService: any, maxRetries: number = 5): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const code = generateTicketCode()
        // Check if code already exists
        const existing = await ticketsService.readByQuery({
            filter: { ticket_code: { _eq: code } },
            limit: 1,
        })
        if (!existing || existing.length === 0) {
            return code
        }
    }
    // If all retries fail, add timestamp for guaranteed uniqueness
    const timestamp = Date.now().toString(36).toUpperCase()
    return `TKT-${timestamp}`
}

/**
 * Generate QR code as base64 data URL for embedding in emails
 */
export async function generateQRCodeDataUrl(ticketCode: string, websiteUrl: string): Promise<string> {
    const verifyUrl = `${websiteUrl}/ticket/${ticketCode}`
    try {
        return await QRCode.toDataURL(verifyUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        })
    } catch (err) {
        // Fallback: return empty string if QR generation fails
        console.error('Failed to generate QR code:', err)
        return ''
    }
}

/**
 * Format price in Euro
 */
export function formatPrice(cents: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100)
}

/**
 * Build the HTML for a single ticket card (for embedding in emails)
 */
export function buildTicketCardHtml(ticket: {
    attendeeName: string
    attendeeEmail: string
    ticketCode: string
    qrCodeDataUrl: string
}): string {
    return `
        <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #00A1FF;">${ticket.attendeeName}</h3>
            <p style="margin: 5px 0; color: #666;">Ticket-Code: <strong>${ticket.ticketCode}</strong></p>
            <p style="margin: 5px 0; color: #666;">E-Mail: ${ticket.attendeeEmail}</p>
            ${ticket.qrCodeDataUrl ? `
            <div style="text-align: center; margin-top: 15px;">
                <img src="${ticket.qrCodeDataUrl}" alt="QR Code" style="width: 200px; height: 200px;" />
            </div>
            ` : ''}
            <p style="text-align: center; font-size: 12px; color: #999;">
                Bitte zeige diesen QR-Code oder den Ticket-Code beim Check-in vor.
            </p>
        </div>
    `
}

/**
 * Build the HTML for a list of ticket cards
 */
export function buildTicketListHtml(
    tickets: Array<{
        attendeeName: string
        attendeeEmail: string
        ticketCode: string
        qrCodeDataUrl: string
    }>
): string {
    return tickets.map((ticket) => buildTicketCardHtml(ticket)).join('')
}
