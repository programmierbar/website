type EmailData = {
    to: string
    subject: string
    html: string
    attachments?: Array<{
        filename: string
        content: Buffer | string
        contentType?: string
        cid?: string
    }>
}

/**
 * Helper function that sends an email via Mailgun API.
 *
 * @param emailData The email data including optional attachments.
 */
export async function sendEmail(emailData: EmailData): Promise<void> {
    const config = useRuntimeConfig()

    const apiKey = config.emailMailgunApiKey
    const domain = config.emailMailgunDomain
    const host = config.emailMailgunHost || 'api.eu.mailgun.net'
    const from = config.emailFrom || 'noreply@programmier.bar'

    if (!apiKey || !domain) {
        throw new Error('Mailgun API key or domain not configured')
    }

    const url = `https://${host}/v3/${domain}/messages`

    // Create form data for Mailgun API
    const formData = new FormData()
    formData.append('from', `programmier.bar <${from}>`)
    formData.append('to', emailData.to)
    formData.append('subject', emailData.subject)
    formData.append('html', emailData.html)

    // Handle attachments
    if (emailData.attachments && emailData.attachments.length > 0) {
        for (const attachment of emailData.attachments) {
            let blob: Blob
            if (typeof attachment.content === 'string') {
                // Base64 encoded content
                const binaryString = atob(attachment.content)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }
                blob = new Blob([bytes], { type: attachment.contentType || 'application/octet-stream' })
            } else {
                // Buffer content
                blob = new Blob([attachment.content], { type: attachment.contentType || 'application/octet-stream' })
            }

            if (attachment.cid) {
                // Inline attachment (for embedding images in HTML)
                formData.append('inline', blob, attachment.filename)
            } else {
                formData.append('attachment', blob, attachment.filename)
            }
        }
    }

    // Send request to Mailgun API
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
        },
        body: formData,
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Mailgun API error: ${response.status} ${errorText}`)
    }
}
