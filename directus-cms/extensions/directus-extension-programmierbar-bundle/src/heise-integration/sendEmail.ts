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
    replyTo?: string
}

/**
 * Send an email using nodemailer SMTP.
 * Used for Heise.de document emails.
 */
export async function sendEmail(emailData: EmailData, config: EmailConfig, logger: Logger): Promise<void> {
    try {
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

        const mailOptions: nodemailer.default.SendMailOptions = {
            from: config.from,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
        }

        if (emailData.replyTo) {
            mailOptions.replyTo = emailData.replyTo
        }

        await transporter.sendMail(mailOptions)

        logger.info(`Email sent successfully to ${emailData.to}`)
    } catch (err: any) {
        logger.error(`Failed to send email to ${emailData.to}: ${err?.message || err}`)
        throw err
    }
}
