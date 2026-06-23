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
 * Generate QR code as a PNG buffer for CID email embedding
 */
export async function generateQRCodeBuffer(ticketCode: string, websiteUrl: string): Promise<Buffer> {
    const verifyUrl = `${websiteUrl}/ticket/${ticketCode}`
    return await QRCode.toBuffer(verifyUrl, {
        width: 200,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#ffffff',
        },
    })
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
