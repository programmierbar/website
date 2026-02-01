import type { Logger } from 'pino'

export interface EmailConfig {
    host: string
    port: number
    secure: boolean
    user: string
    password: string
    from: string
}

export interface EmailData {
    to: string
    subject: string
    html: string
}

/**
 * Send an email using SMTP via native fetch (Directus hook compatible).
 * This is a simplified email sender that works within Directus hooks.
 *
 * Note: For production, consider using the Directus mail service or
 * a more robust email library. This implementation uses a simple
 * HTTP-based email service approach.
 */
export async function sendEmail(emailData: EmailData, config: EmailConfig, logger: Logger): Promise<void> {
    // Use nodemailer-style SMTP if available, otherwise fall back to fetch-based approach
    // Since this runs in Directus (Node.js), we can dynamically import nodemailer

    try {
        // Dynamically import nodemailer (should be available in Node.js environment)
        const nodemailer = await import('nodemailer')

        const transporter = nodemailer.default.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.password,
            },
        })

        await transporter.sendMail({
            from: config.from,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
        })

        logger.info(`Email sent successfully to ${emailData.to}`)
    } catch (err: any) {
        logger.error(`Failed to send email to ${emailData.to}: ${err?.message || err}`)
        throw err
    }
}
