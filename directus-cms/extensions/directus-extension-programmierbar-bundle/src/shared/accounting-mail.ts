/**
 * Accounting copy of every invoice document.
 *
 * Each generated invoice document (Rechnung, Rechnungsberichtigung, Stornorechnung) is
 * mailed to an accounting mailbox, one PDF per mail, so it is recorded in the books
 * promptly (GoBD). This is a separate mail — never a BCC on the customer mail — and is
 * independent of whether the customer mail went out: the document exists either way.
 *
 * The accounting mailbox uploads attachments into the bookkeeping system and rejects
 * mails with links, images, logos or QR codes. So the mail is plain text only (no HTML,
 * no template, no links, no signature), carries exactly one PDF, and names the invoice
 * number in the subject.
 *
 * It also rejects (550 at RCPT TO) every mail whose SMTP envelope sender (MAIL FROM) is
 * not the registered sender address. The Directus MailService goes through the
 * transactional mail provider, which always uses its own return path, so it can never
 * satisfy that check. The accounting copy therefore uses its own SMTP transport
 * (`ACCOUNTING_SMTP_*`, `ACCOUNTING_MAIL_FROM`) and sets both `from` and the envelope
 * sender explicitly. There is deliberately no fallback to the MailService: it would only
 * produce bounces.
 *
 * The mailbox comes from `ACCOUNTING_INVOICE_EMAIL`. Without it the accounting copy is
 * skipped (info log), so environments without bookkeeping (local, staging) keep working
 * unchanged. With it but an incomplete SMTP configuration, the copy is skipped with a
 * warning and a Slack alert (once per process) — that needs a human.
 */

import nodemailer from 'nodemailer'
import type { InvoiceDocumentKind } from './invoice-generator.js'
import { INVOICE_DOCUMENT_LABEL } from './invoice-service.js'
import { postSlackMessage } from './postSlackMessage.js'

export const ACCOUNTING_INVOICE_EMAIL_ENV = 'ACCOUNTING_INVOICE_EMAIL'

/** Env vars the dedicated SMTP transport needs (`ACCOUNTING_SMTP_SECURE` is optional). */
export const ACCOUNTING_SMTP_REQUIRED_ENV = [
    'ACCOUNTING_SMTP_HOST',
    'ACCOUNTING_SMTP_PORT',
    'ACCOUNTING_SMTP_USER',
    'ACCOUNTING_SMTP_PASSWORD',
    'ACCOUNTING_MAIL_FROM',
] as const

/** How often to attempt sending the accounting copy before escalating to Slack. */
export const ACCOUNTING_MAIL_ATTEMPTS = 3

export interface AccountingInvoiceDocument {
    documentKind: InvoiceDocumentKind
    invoiceNumber: string
    /** The exact bytes of the stored PDF. */
    pdfBuffer: Buffer
    /** Same file name as the stored PDF, e.g. `Rechnung-PB-CON26-001.pdf`. */
    invoiceFileName: string
    orderNumber?: string | null
    /** Number of the corrected/cancelled invoice (corrections and cancellations only). */
    referenceNumber?: string | null
    /**
     * The document was re-rendered under the same number (pre-issuance regenerate), so
     * accounting may already hold an earlier version that this one replaces.
     */
    replacesPreviousVersion?: boolean
}

export type AccountingMailResult = 'sent' | 'skipped' | 'misconfigured' | 'failed'

type Env = Record<string, unknown> | undefined

export interface AccountingMailOptions {
    /** The extension's env (hook/endpoint context `env`). */
    env: Env
    logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }
    /** Hook or endpoint name, for logs and the Slack alert. */
    source: string
}

export interface AccountingSmtpConfig {
    host: string
    port: number
    secure: boolean
    user: string
    password: string
    /** The sender address registered with the accounting mailbox; also the envelope sender. */
    from: string
}

/** Directus casts env values ("465" → 465, "true" → true); accept both forms. */
function envString(env: Env, key: string): string | null {
    const value = env?.[key]
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }
    if (typeof value !== 'string') {
        return null
    }
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

/** The configured accounting mailbox, or null when the env var is unset or empty. */
export function getAccountingInvoiceEmail(env: Env): string | null {
    const value = env?.[ACCOUNTING_INVOICE_EMAIL_ENV]
    return typeof value === 'string' ? envString(env, ACCOUNTING_INVOICE_EMAIL_ENV) : null
}

/**
 * The dedicated SMTP transport's settings, or the names of the missing env vars.
 *
 * `ACCOUNTING_SMTP_SECURE` has the same meaning as Directus' `EMAIL_SMTP_SECURE`: true
 * means implicit TLS (port 465), false means STARTTLS (port 587). Setting it to true on
 * 587 fails the handshake, so when it is unset it is derived from the port.
 */
export function getAccountingSmtpConfig(
    env: Env
): { config: AccountingSmtpConfig; missing: [] } | { config: null; missing: string[] } {
    const missing: string[] = ACCOUNTING_SMTP_REQUIRED_ENV.filter((key) => envString(env, key) === null)
    const port = Number(envString(env, 'ACCOUNTING_SMTP_PORT'))
    if (envString(env, 'ACCOUNTING_SMTP_PORT') !== null && !(Number.isInteger(port) && port > 0)) {
        missing.push('ACCOUNTING_SMTP_PORT')
    }
    if (missing.length > 0) {
        return { config: null, missing: [...new Set(missing)] }
    }

    const secureRaw = envString(env, 'ACCOUNTING_SMTP_SECURE')
    const secure = secureRaw === null ? port === 465 : secureRaw.toLowerCase() === 'true'

    return {
        config: {
            host: envString(env, 'ACCOUNTING_SMTP_HOST')!,
            port,
            secure,
            user: envString(env, 'ACCOUNTING_SMTP_USER')!,
            password: envString(env, 'ACCOUNTING_SMTP_PASSWORD')!,
            from: envString(env, 'ACCOUNTING_MAIL_FROM')!,
        },
        missing: [],
    }
}

// Process-wide state: one lazily created transport, one misconfiguration alert.
let cachedTransport: { key: string; transport: { sendMail: (mail: any) => Promise<unknown> } } | null = null
let misconfigurationAlerted = false

/** Reset the lazily created transport and the once-per-process alert flag (tests only). */
export function resetAccountingMailState(): void {
    cachedTransport = null
    misconfigurationAlerted = false
}

function getTransport(config: AccountingSmtpConfig) {
    const key = JSON.stringify(config)
    if (!cachedTransport || cachedTransport.key !== key) {
        cachedTransport = {
            key,
            transport: nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure,
                // Without implicit TLS, insist on STARTTLS: credentials never go out in clear.
                requireTLS: !config.secure,
                auth: { user: config.user, pass: config.password },
            }),
        }
    }
    return cachedTransport.transport
}

/** Minimal subject and one-line plain-text body — no cover letter needed. */
export function buildAccountingMail(doc: AccountingInvoiceDocument): { subject: string; text: string } {
    const name = `${INVOICE_DOCUMENT_LABEL[doc.documentKind]} ${doc.invoiceNumber}`
    const subject = doc.replacesPreviousVersion ? `${name} (ersetzt vorherige Fassung)` : name

    let text = name
    if (doc.referenceNumber) {
        text += ` zu Rechnung ${doc.referenceNumber}`
    }
    if (doc.orderNumber) {
        text += ` (Bestellung ${doc.orderNumber})`
    }
    text += ' im Anhang.'
    if (doc.replacesPreviousVersion) {
        text += ' Diese Fassung ersetzt die zuvor übermittelte mit derselben Rechnungsnummer.'
    }

    return { subject, text: `${text}\n` }
}

/**
 * Mail the document to the accounting mailbox. Never throws: a failing accounting copy
 * must not fail order processing or a lifecycle operation. Retries a few times and, on
 * persistent failure, alerts Slack with the invoice number so a human forwards the PDF.
 *
 * Deliberately does not touch `sent_at` — that records the customer dispatch only.
 */
export async function sendInvoiceToAccounting(
    doc: AccountingInvoiceDocument,
    options: AccountingMailOptions
): Promise<AccountingMailResult> {
    const { logger, source } = options

    try {
        const to = getAccountingInvoiceEmail(options.env)
        if (!to) {
            logger.info(
                `${source}: ${ACCOUNTING_INVOICE_EMAIL_ENV} is not set — skipping accounting copy of ${doc.invoiceNumber}`
            )
            return 'skipped'
        }

        const { config, missing } = getAccountingSmtpConfig(options.env)
        if (!config) {
            logger.warn(
                `${source}: ${ACCOUNTING_INVOICE_EMAIL_ENV} is set but ${missing.join(', ')} missing or invalid — skipping accounting copy of ${doc.invoiceNumber}`
            )
            if (!misconfigurationAlerted) {
                misconfigurationAlerted = true
                try {
                    await postSlackMessage(
                        `:warning: *${source}*: Rechnungskopien an die Buchhaltung werden nicht verschickt — ${ACCOUNTING_INVOICE_EMAIL_ENV} ist gesetzt, aber ${missing.join(', ')} fehlt bzw. ist ungültig. Erste betroffene Rechnung: ${doc.invoiceNumber}. Bitte die Directus-Umgebung ergänzen, neu starten und die seitdem erzeugten PDFs manuell an die Buchhaltung weiterleiten (Directus-Log nennt jede Nummer). Dieser Hinweis kommt nur einmal pro Prozessstart.`
                    )
                } catch (slackErr: any) {
                    logger.error(`${source}: Failed to send Slack notification: ${slackErr?.message || slackErr}`)
                }
            }
            return 'misconfigured'
        }

        const { subject, text } = buildAccountingMail(doc)
        for (let attempt = 1; attempt <= ACCOUNTING_MAIL_ATTEMPTS; attempt++) {
            try {
                // Inside the retry: a transport that cannot be created ends up in the Slack alert too.
                const transport = getTransport(config)
                await transport.sendMail({
                    from: config.from,
                    to,
                    // The accounting mailbox checks MAIL FROM against the registered sender.
                    envelope: { from: config.from, to },
                    subject,
                    text,
                    attachments: [
                        {
                            filename: doc.invoiceFileName,
                            content: doc.pdfBuffer,
                            contentType: 'application/pdf',
                        },
                    ],
                })
                logger.info(`${source}: Sent accounting copy of ${doc.invoiceNumber}`)
                return 'sent'
            } catch (err: any) {
                logger.warn(
                    `${source}: Attempt ${attempt}/${ACCOUNTING_MAIL_ATTEMPTS} to send the accounting copy of ${doc.invoiceNumber} failed: ${err?.message || err}`
                )
            }
        }

        const label = INVOICE_DOCUMENT_LABEL[doc.documentKind]
        const order = doc.orderNumber ? ` zu Bestellung ${doc.orderNumber}` : ''
        logger.error(
            `${source}: Accounting copy of ${label} ${doc.invoiceNumber}${order} could not be sent after ${ACCOUNTING_MAIL_ATTEMPTS} attempts`
        )
        try {
            await postSlackMessage(
                `:warning: *${source}*: ${label} ${doc.invoiceNumber}${order} konnte nach ${ACCOUNTING_MAIL_ATTEMPTS} Versuchen nicht an das Buchhaltungspostfach geschickt werden. Bitte das PDF (${doc.invoiceFileName}) aus Directus manuell an die Buchhaltung weiterleiten. Details im Directus-Log.`
            )
        } catch (slackErr: any) {
            logger.error(`${source}: Failed to send Slack notification: ${slackErr?.message || slackErr}`)
        }
        return 'failed'
    } catch (err: any) {
        // Last line of defence: nothing in here may break the caller.
        logger.error(
            `${source}: Unexpected error sending accounting copy of ${doc.invoiceNumber}: ${err?.message || err}`
        )
        return 'failed'
    }
}
