import nodemailer from 'nodemailer'

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
 * Helper function that sends an email via SMTP.
 *
 * @param emailData The email data including optional attachments.
 */
export async function sendEmail(emailData: EmailData): Promise<void> {
    const config = useRuntimeConfig()

    const host = config.emailSmtpHost
    const port = Number(config.emailSmtpPort) || 465
    const user = config.emailSmtpUser
    const pass = config.emailSmtpPass
    const from = config.emailFrom || 'noreply@programmier.bar'

    if (!host || !user || !pass) {
        throw new Error('SMTP host, user, or password not configured')
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    })

    await transporter.sendMail({
        from: `programmier.bar <${from}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        attachments: emailData.attachments?.map((att) => ({
            filename: att.filename,
            content: typeof att.content === 'string' ? Buffer.from(att.content, 'base64') : att.content,
            contentType: att.contentType,
            cid: att.cid,
        })),
    })
}
