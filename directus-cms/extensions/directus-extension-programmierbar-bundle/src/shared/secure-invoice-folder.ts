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
 * in the log and alert Slack, once per process (retried with the next invoice if
 * the Slack message could not be delivered).
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
            // Not delivered: let the next invoice try again.
            missingFolderReported = false
            logger.error(`secure-invoice-folder: Could not send Slack alert: ${error?.message ?? error}`)
        })
    }

    return undefined
}

let rejectedFolderReported = false

/**
 * Whether `FilesService.uploadOne` failed because Directus rejected `folder` itself. The
 * `directus_files` row is inserted before anything is stored, so both cases leave nothing behind:
 * - unknown id: the folder foreign key fails, translated to `InvalidForeignKeyError`
 *   (`code` INVALID_FOREIGN_KEY). Postgres names the field; SQLite (local dev) cannot (`field` null).
 * - malformed id (Postgres): the uuid cast fails with SQLSTATE 22P02, which Directus passes
 *   through untranslated; the message quotes the rejected value.
 */
function isRejectedFolderError(error: any, folder: string): boolean {
    if (error?.code === 'INVALID_FOREIGN_KEY') {
        const field = error.extensions?.field
        return field === 'folder' || field === null || field === undefined
    }
    return error?.code === '22P02' && String(error.message).includes(`"${folder}"`)
}

/**
 * Run an invoice upload into `folder`, falling back to the public file library when Directus
 * rejects the folder (unknown or malformed `INVOICE_FILES_FOLDER`, see `isRejectedFolderError`).
 * Same trade-off as an unset folder: the invoice flow keeps working, a warning is logged
 * and Slack is alerted (once per process, like above) so the config can be fixed and the file moved.
 * Any other upload error is rethrown unchanged — a transient failure must never publish an
 * invoice. Without a folder there is nothing to fall back from; a failing retry throws as before.
 */
export async function uploadWithInvoiceFolderFallback(
    upload: (folder: string | undefined) => Promise<string>,
    options: { folder?: string; invoiceNumber: string; logger?: { warn: (message: string) => void } }
): Promise<string> {
    const { folder, invoiceNumber, logger } = options
    if (!folder) {
        return upload(undefined)
    }

    try {
        return await upload(folder)
    } catch (error: any) {
        if (!isRejectedFolderError(error, folder)) {
            throw error
        }
        const fileId = await upload(undefined)
        const message = `Could not store invoice ${invoiceNumber} in ${INVOICE_FILES_FOLDER_ENV} folder "${folder}" (${error?.message ?? error}) — stored it in the public file library instead. Check ${INVOICE_FILES_FOLDER_ENV} (see docs/tickets.md) and move the file into the invoice folder.`
        logger?.warn(`secure-invoice-folder: ${message}`)
        if (!rejectedFolderReported) {
            rejectedFolderReported = true
            postSlackMessage(`:rotating_light: *Invoices*: ${message}`).catch((slackError: any) => {
                rejectedFolderReported = false
                logger?.warn(`secure-invoice-folder: Could not send Slack alert: ${slackError?.message ?? slackError}`)
            })
        }
        return fileId
    }
}
