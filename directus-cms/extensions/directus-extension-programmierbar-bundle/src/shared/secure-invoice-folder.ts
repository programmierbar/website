import { postSlackMessage } from './postSlackMessage.js'

/** Directus env var holding the id of the folder invoice PDFs are uploaded into. */
export const INVOICE_FILES_FOLDER_ENV = 'INVOICE_FILES_FOLDER'

let missingFolderReported = false

/**
 * The `directus_files` folder invoice PDFs (Rechnung, Rechnungsberichtigung,
 * Stornorechnung) are uploaded into. The Public policy must not be able to read
 * that folder (see docs/tickets.md) — files outside it are publicly downloadable
 * via `/assets/<id>`.
 *
 * When `INVOICE_FILES_FOLDER` is unset, invoicing keeps working (the PDF lands in
 * the general file library), but it needs a human to fix the configuration: warn
 * in the log and alert Slack, once per process.
 */
export function invoiceFilesFolder(
    env: Record<string, any>,
    logger: { warn: (message: string) => void; error: (message: string) => void }
): string | undefined {
    const folder = typeof env[INVOICE_FILES_FOLDER_ENV] === 'string' ? env[INVOICE_FILES_FOLDER_ENV].trim() : ''
    if (folder) {
        return folder
    }

    if (!missingFolderReported) {
        missingFolderReported = true
        const message = `${INVOICE_FILES_FOLDER_ENV} is not set — invoice PDFs are uploaded to the public file library and can be downloaded via /assets/<id>. Set it to the id of the private invoice folder (see docs/tickets.md).`
        logger.warn(`secure-invoice-folder: ${message}`)
        postSlackMessage(`:rotating_light: *Invoices*: ${message}`).catch((error: any) => {
            logger.error(`secure-invoice-folder: Could not send Slack alert: ${error?.message ?? error}`)
        })
    }

    return undefined
}
