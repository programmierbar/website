// Turns speaker portal API responses into data or a message a guest speaker can act on.
//
// Not every error response comes from our own handlers: Vercel answers an oversized upload with a
// plain-text 413 and a timed-out function with a plain-text 504, before or instead of our code. Calling
// `response.json()` on those throws a SyntaxError whose browser-specific wording ("JSON.parse:
// unexpected character at line 1 column 1 …") used to end up on screen. So the body is only parsed when
// it is actually JSON, the technical detail goes to the console, and the user sees a sentence from here.

export const SPEAKER_PORTAL_CONTACT_EMAIL = 'podcast@programmier.bar'

const GENERIC_ERROR_MESSAGE = `Da ist leider etwas schiefgelaufen. Bitte versuche es in ein paar Minuten noch einmal oder schreib uns an ${SPEAKER_PORTAL_CONTACT_EMAIL}.`

const NETWORK_ERROR_MESSAGE =
    'Wir konnten unseren Server gerade nicht erreichen. Bitte prüfe deine Internetverbindung und versuche es noch einmal.'

const PAYLOAD_TOO_LARGE_MESSAGE =
    'Deine Bilder sind zusammen zu groß zum Hochladen. Bitte wähle kleinere Bilder aus und versuche es noch einmal.'

// Used when one of these statuses arrives without a message from our own handler.
const DEFAULT_CLIENT_ERROR_MESSAGES: Record<number, string> = {
    400: 'Bitte überprüfe deine Angaben und versuche es noch einmal.',
    404: `Dein Zugangslink ist leider ungültig. Bitte nutze den Link aus deiner Einladungs-E-Mail oder schreib uns an ${SPEAKER_PORTAL_CONTACT_EMAIL}.`,
    409: `Du hast deine Informationen bereits eingereicht. Schreib uns an ${SPEAKER_PORTAL_CONTACT_EMAIL}, falls du noch etwas ändern möchtest.`,
    410: `Dein Zugangslink ist leider abgelaufen. Schreib uns an ${SPEAKER_PORTAL_CONTACT_EMAIL}, dann schicken wir dir einen neuen.`,
}

/** An error whose `message` is safe to show to the user as-is. */
export class SpeakerPortalError extends Error {
    constructor(
        message: string,
        readonly status?: number
    ) {
        super(message)
        this.name = 'SpeakerPortalError'
    }
}

function getServerMessage(body: unknown): string | undefined {
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
        return body.message.trim() || undefined
    }
    return undefined
}

/**
 * The message to show for a failed response. Only the 4xx statuses our handlers answer deliberately
 * pass the handler's own (German, user-facing) message through; anything else gets a fixed sentence.
 */
export function getSpeakerPortalErrorMessage(status: number, body: unknown): string {
    if (status === 413) {
        return PAYLOAD_TOO_LARGE_MESSAGE
    }
    const defaultMessage = DEFAULT_CLIENT_ERROR_MESSAGES[status]
    if (defaultMessage) {
        return getServerMessage(body) ?? defaultMessage
    }
    return GENERIC_ERROR_MESSAGE
}

/**
 * Performs a speaker portal API request and returns the parsed JSON body of a successful response.
 * Always rejects with a SpeakerPortalError, never with a raw fetch or JSON error.
 */
export async function requestSpeakerPortal<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
        response = await fetch(url, init)
    } catch (error) {
        console.error(`Speaker portal request to ${url} failed before a response arrived:`, error)
        throw new SpeakerPortalError(NETWORK_ERROR_MESSAGE)
    }

    const contentType = response.headers.get('content-type') ?? ''
    let text = ''
    let body: unknown
    try {
        text = await response.text()
        body = contentType.includes('application/json') ? JSON.parse(text) : undefined
    } catch (error) {
        console.error(`Speaker portal response from ${url} could not be read:`, error)
    }

    if (!response.ok) {
        console.error(`Speaker portal request to ${url} failed with HTTP ${response.status}:`, {
            contentType,
            vercelError: response.headers.get('x-vercel-error'),
            body: body ?? text.slice(0, 500),
        })
        throw new SpeakerPortalError(getSpeakerPortalErrorMessage(response.status, body), response.status)
    }

    if (body === undefined) {
        console.error(`Speaker portal response from ${url} was not JSON:`, {
            status: response.status,
            contentType,
            body: text.slice(0, 500),
        })
        throw new SpeakerPortalError(GENERIC_ERROR_MESSAGE, response.status)
    }

    return body as T
}

/** The message to show for anything a speaker portal action threw. */
export function getSpeakerPortalUserMessage(error: unknown): string {
    if (error instanceof SpeakerPortalError) {
        return error.message
    }
    console.error('Unexpected speaker portal error:', error)
    return GENERIC_ERROR_MESSAGE
}
