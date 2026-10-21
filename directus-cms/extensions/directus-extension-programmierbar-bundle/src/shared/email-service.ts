/**
 * Shared email service for Directus hooks.
 *
 * This module provides:
 * - Template rendering using Handlebars syntax
 * - Email sending via Directus MailService
 * - Reading templates from the email_templates collection
 *
 * Reading values from the automation_settings collection lives in `settings.ts`.
 */

import type { Logger } from 'pino'
import { escapeHtml } from './html.ts'

// Simple Handlebars-like template rendering
// Supports: {{variable}}, {{{rawHtml}}}, {{#if condition}}...{{/if}}
function renderTemplate(template: string, data: Record<string, any>): string {
    let result = template

    // Handle {{{raw}}} - triple braces for unescaped HTML
    result = result.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => {
        return data[key] ?? ''
    })

    // Handle {{#if condition}}...{{/if}} blocks
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, condition, content) => {
        const value = data[condition]
        if (value && value !== '' && value !== false && value !== null && value !== undefined) {
            return content
        }
        return ''
    })

    // Handle {{variable}} - double braces for escaped content
    result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const value = data[key]
        if (value === null || value === undefined) return ''
        // Escape HTML for security
        return escapeHtml(String(value))
    })

    return result
}

export interface EmailServiceContext {
    logger: Logger
    services: {
        ItemsService: any
        MailService: any
    }
    getSchema: () => Promise<any>
    accountability?: any
}

export interface EmailAttachment {
    filename: string
    content: Buffer
    contentType?: string
    cid?: string
}

export interface SendEmailOptions {
    templateKey: string
    to: string
    data: Record<string, any>
    replyTo?: string
    cc?: string
    attachments?: EmailAttachment[]
    /** Extra mail headers (e.g. List-Unsubscribe); passed through MailService to nodemailer. */
    headers?: Record<string, string>
}

type EmailTemplate = { subject: string; body_html: string }

/** Read a template row; null when no row has the key. Throws when the read itself fails. */
async function readEmailTemplate(key: string, context: EmailServiceContext): Promise<EmailTemplate | null> {
    const { services, getSchema } = context
    const { ItemsService } = services

    const schema = await getSchema()
    const templatesService = new ItemsService('email_templates', {
        schema,
        accountability: { admin: true },
    })

    const templates = await templatesService.readByQuery({
        filter: { key: { _eq: key } },
        fields: ['subject', 'body_html'],
        limit: 1,
    })

    return templates && templates.length > 0 ? templates[0] : null
}

/** Attachments in the shape MailService expects (PDF unless stated otherwise). */
function toMailAttachments(attachments: EmailAttachment[]) {
    return attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || 'application/pdf',
        ...(a.cid && { cid: a.cid }),
    }))
}

/**
 * Get an email template from the email_templates collection.
 */
export async function getEmailTemplate(key: string, context: EmailServiceContext): Promise<EmailTemplate | null> {
    const { logger } = context

    try {
        const template = await readEmailTemplate(key, context)
        if (!template) {
            logger.warn(`Email template '${key}' not found`)
        }
        return template
    } catch (err: any) {
        logger.error(`Failed to read email template '${key}': ${err?.message || err}`)
        return null
    }
}

/**
 * Outcome of {@link deliverTemplatedEmail}. `template_missing` means no `email_templates`
 * row has the key — a setup problem a human has to fix in the CMS, as opposed to `failed`
 * (template read or mail transport error).
 */
export type TemplatedEmailResult = 'sent' | 'template_missing' | 'failed'

/**
 * Send an email using a template from the CMS, reporting why it was not sent. Never throws.
 * Callers that must react to a missing template (e.g. with a Slack alert) use this one;
 * {@link sendTemplatedEmail} is the boolean shorthand.
 */
export async function deliverTemplatedEmail(
    options: SendEmailOptions,
    context: EmailServiceContext
): Promise<TemplatedEmailResult> {
    const { logger, services, getSchema } = context
    const { MailService } = services

    let template: EmailTemplate | null
    try {
        template = await readEmailTemplate(options.templateKey, context)
    } catch (err: any) {
        logger.error(`Failed to read email template '${options.templateKey}': ${err?.message || err}`)
        return 'failed'
    }
    if (!template) {
        logger.error(`Cannot send email: template '${options.templateKey}' not found`)
        return 'template_missing'
    }

    try {
        // Render subject and body with data
        const subject = renderTemplate(template.subject, options.data)
        const html = renderTemplate(template.body_html, options.data)

        // Get schema for MailService
        const schema = await getSchema()

        // Create MailService instance
        const mailService = new MailService({
            schema,
            accountability: { admin: true },
        })

        // Send the email
        await mailService.send({
            to: options.to,
            subject,
            html,
            ...(options.replyTo && { replyTo: options.replyTo }),
            ...(options.cc && { cc: options.cc }),
            ...(options.headers && { headers: options.headers }),
            ...(options.attachments && { attachments: toMailAttachments(options.attachments) }),
        })

        logger.info(`Email sent to ${options.to} using template '${options.templateKey}'`)
        return 'sent'
    } catch (err: any) {
        logger.error(`Failed to send email to ${options.to}: ${err?.message || err}`)
        return 'failed'
    }
}

/**
 * Send an email using a template from the CMS.
 */
export async function sendTemplatedEmail(options: SendEmailOptions, context: EmailServiceContext): Promise<boolean> {
    return (await deliverTemplatedEmail(options, context)) === 'sent'
}

/**
 * Send a raw email (without using a template from CMS).
 * Useful for dynamically generated content. Without `html` the mail is plain text only.
 */
export async function sendRawEmail(
    options: {
        to: string
        subject: string
        replyTo?: string
        /** Extra mail headers (e.g. List-Unsubscribe); passed through MailService to nodemailer. */
        headers?: Record<string, string>
        attachments?: EmailAttachment[]
    } & (
        | {
              html: string
              /** Plain-text alternative, for clients that don't render HTML. */
              text?: string
          }
        | { html?: undefined; text: string }
    ),
    context: EmailServiceContext
): Promise<boolean> {
    const { logger, services, getSchema } = context
    const { MailService } = services

    try {
        const schema = await getSchema()

        const mailService = new MailService({
            schema,
            accountability: { admin: true },
        })

        await mailService.send({
            to: options.to,
            subject: options.subject,
            ...(options.html !== undefined && { html: options.html }),
            ...(options.text && { text: options.text }),
            ...(options.replyTo && { replyTo: options.replyTo }),
            ...(options.headers && { headers: options.headers }),
            ...(options.attachments && { attachments: toMailAttachments(options.attachments) }),
        })

        logger.info(`Email sent to ${options.to}`)
        return true
    } catch (err: any) {
        logger.error(`Failed to send email to ${options.to}: ${err?.message || err}`)
        return false
    }
}

/**
 * Format a date in German locale.
 */
export function formatDateGerman(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }

    return new Date(date).toLocaleDateString('de-DE', options || defaultOptions)
}
