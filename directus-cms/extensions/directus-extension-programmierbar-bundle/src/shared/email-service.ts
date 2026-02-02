/**
 * Shared email service for Directus hooks.
 *
 * This module provides:
 * - Template rendering using Handlebars syntax
 * - Email sending via Directus MailService
 * - Reading templates from the email_templates collection
 * - Reading settings from the automation_settings collection
 */

import type { Logger } from 'pino'

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
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
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

export interface SendEmailOptions {
    templateKey: string
    to: string
    data: Record<string, any>
    replyTo?: string
}

/**
 * Get a setting value from the automation_settings collection.
 */
export async function getSetting(
    key: string,
    context: EmailServiceContext
): Promise<string | null> {
    const { services, getSchema, accountability, logger } = context
    const { ItemsService } = services

    try {
        const schema = await getSchema()
        const settingsService = new ItemsService('automation_settings', {
            schema,
            accountability: accountability || { admin: true },
        })

        const settings = await settingsService.readByQuery({
            filter: { key: { _eq: key } },
            fields: ['value'],
            limit: 1,
        })

        if (settings && settings.length > 0) {
            return settings[0].value
        }

        return null
    } catch (err: any) {
        logger.warn(`Failed to read setting '${key}': ${err?.message || err}`)
        return null
    }
}

/**
 * Get multiple settings as an object.
 */
export async function getSettings(
    keys: string[],
    context: EmailServiceContext
): Promise<Record<string, string>> {
    const { services, getSchema, accountability, logger } = context
    const { ItemsService } = services

    const result: Record<string, string> = {}

    try {
        const schema = await getSchema()
        const settingsService = new ItemsService('automation_settings', {
            schema,
            accountability: accountability || { admin: true },
        })

        const settings = await settingsService.readByQuery({
            filter: { key: { _in: keys } },
            fields: ['key', 'value'],
        })

        for (const setting of settings) {
            result[setting.key] = setting.value
        }
    } catch (err: any) {
        logger.warn(`Failed to read settings: ${err?.message || err}`)
    }

    return result
}

/**
 * Get an email template from the email_templates collection.
 */
export async function getEmailTemplate(
    key: string,
    context: EmailServiceContext
): Promise<{ subject: string; body_html: string } | null> {
    const { services, getSchema, accountability, logger } = context
    const { ItemsService } = services

    try {
        const schema = await getSchema()
        const templatesService = new ItemsService('email_templates', {
            schema,
            accountability: accountability || { admin: true },
        })

        const templates = await templatesService.readByQuery({
            filter: { key: { _eq: key } },
            fields: ['subject', 'body_html'],
            limit: 1,
        })

        if (templates && templates.length > 0) {
            return templates[0]
        }

        logger.warn(`Email template '${key}' not found`)
        return null
    } catch (err: any) {
        logger.error(`Failed to read email template '${key}': ${err?.message || err}`)
        return null
    }
}

/**
 * Send an email using a template from the CMS.
 */
export async function sendTemplatedEmail(
    options: SendEmailOptions,
    context: EmailServiceContext
): Promise<boolean> {
    const { logger, services, getSchema, accountability } = context
    const { MailService } = services

    try {
        // Get the template
        const template = await getEmailTemplate(options.templateKey, context)
        if (!template) {
            logger.error(`Cannot send email: template '${options.templateKey}' not found`)
            return false
        }

        // Render subject and body with data
        const subject = renderTemplate(template.subject, options.data)
        const html = renderTemplate(template.body_html, options.data)

        // Get schema for MailService
        const schema = await getSchema()

        // Create MailService instance
        const mailService = new MailService({
            schema,
            accountability: accountability || { admin: true },
        })

        // Send the email
        await mailService.send({
            to: options.to,
            subject,
            html,
            ...(options.replyTo && { replyTo: options.replyTo }),
        })

        logger.info(`Email sent to ${options.to} using template '${options.templateKey}'`)
        return true
    } catch (err: any) {
        logger.error(`Failed to send email to ${options.to}: ${err?.message || err}`)
        return false
    }
}

/**
 * Send a raw email (without using a template from CMS).
 * Useful for dynamically generated content like Heise documents.
 */
export async function sendRawEmail(
    options: {
        to: string
        subject: string
        html: string
        replyTo?: string
    },
    context: EmailServiceContext
): Promise<boolean> {
    const { logger, services, getSchema, accountability } = context
    const { MailService } = services

    try {
        const schema = await getSchema()

        const mailService = new MailService({
            schema,
            accountability: accountability || { admin: true },
        })

        await mailService.send({
            to: options.to,
            subject: options.subject,
            html: options.html,
            ...(options.replyTo && { replyTo: options.replyTo }),
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
