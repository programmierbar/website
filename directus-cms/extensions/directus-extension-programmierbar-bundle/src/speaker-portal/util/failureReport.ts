/**
 * Failure reports from the website's speaker portal (`POST /speaker-portal/:id/report-update-failure`).
 *
 * The website has no Slack access of its own, so when it cannot save a speaker's profile update it
 * reports here and the CMS posts to Slack. Everything in the body comes from outside the CMS, so it
 * is cleaned before it reaches Slack: short, single-line, no Slack markup, no e-mail addresses.
 *
 * Pure and dependency-free on purpose, so it can be unit-tested without Directus.
 */

/** Longest error summary passed to Slack; the website's own logs hold the full error. */
export const FAILURE_MESSAGE_MAX_LENGTH = 300

/** The same speaker and stage is reported to Slack at most once in this window. */
export const FAILURE_REPORT_DEDUPE_MS = 10 * 60 * 1000

/** A stage is a short identifier chosen by the website, e.g. `save_version`. */
const STAGE_PATTERN = /^[a-z0-9_-]{1,40}$/

const EMAIL_PATTERN = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[^\s@<>()[\]"',;:]+/g

// Control characters (including newlines and tabs) and the invisible format characters a
// message could use to hide or reorder text.
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g

export interface FailureReport {
    stage: string
    message: string
}

export type FailureReportResult = { ok: true; report: FailureReport } | { ok: false; error: string }

/**
 * Slack reads `<…>` as links and mentions (`<!channel>`, `<@U123>`) and `&` as the start of an
 * entity; escaping these three is what Slack documents for showing text literally.
 */
function escapeSlack(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** One line of plain text, e-mail addresses redacted, Slack markup neutralised, length-capped. */
export function sanitizeFailureMessage(raw: string): string {
    // Bounded first: the patterns below scan the whole input, and the body comes from outside.
    const cleaned = raw
        .slice(0, FAILURE_MESSAGE_MAX_LENGTH * 4)
        .replace(CONTROL_PATTERN, ' ')
        .replace(EMAIL_PATTERN, '[E-Mail]')
        .replace(/\s+/g, ' ')
        .trim()
    // Capped before escaping, so an entity is never cut in half.
    const capped =
        cleaned.length > FAILURE_MESSAGE_MAX_LENGTH ? `${cleaned.slice(0, FAILURE_MESSAGE_MAX_LENGTH - 1)}…` : cleaned
    return escapeSlack(capped)
}

/** Validates the request body; the error text is meant for the caller (the website's logs). */
export function parseFailureReport(body: unknown): FailureReportResult {
    const input = (body ?? {}) as Record<string, unknown>
    const stage = typeof input.stage === 'string' ? input.stage.trim() : ''
    if (!STAGE_PATTERN.test(stage)) {
        return { ok: false, error: '`stage` must be 1–40 characters of a-z, 0-9, "_" or "-".' }
    }
    if (typeof input.message !== 'string') {
        return { ok: false, error: '`message` must be a string.' }
    }
    const message = sanitizeFailureMessage(input.message)
    return { ok: true, report: { stage, message: message || '(keine Fehlermeldung)' } }
}

/**
 * Remembers which speaker/stage pairs were reported recently. In memory, per CMS process: it only
 * has to stop one broken submission that a speaker retries a few times from becoming a Slack storm,
 * so losing it on a restart is fine.
 */
export function createFailureReportDeduper(windowMs: number = FAILURE_REPORT_DEDUPE_MS) {
    const lastReported = new Map<string, number>()

    function prune(now: number) {
        for (const [key, at] of lastReported) {
            if (now - at >= windowMs) lastReported.delete(key)
        }
    }

    return {
        /** Claims the slot for this pair; `false` if it was already reported within the window. */
        claim(key: string, now: number = Date.now()): boolean {
            prune(now)
            if (lastReported.has(key)) return false
            lastReported.set(key, now)
            return true
        },
        /** Gives the slot back, e.g. when the Slack post failed, so the next report gets through. */
        release(key: string) {
            lastReported.delete(key)
        },
    }
}

export interface FailureSpeaker {
    first_name?: string | null
    last_name?: string | null
    portal_token_expires?: string | null
}

/** The German Slack message for a failed profile update. */
export function buildFailureSlackMessage(options: {
    speaker: FailureSpeaker
    report: FailureReport
    itemUrl: string
    now: Date
    formatDate: (date: string) => string
}): string {
    const { speaker, report, itemUrl, now, formatDate } = options
    const name = escapeSlack(
        [speaker.first_name, speaker.last_name].filter(Boolean).join(' ').replace(CONTROL_PATTERN, ' ').trim() ||
            'Unbekannte:r Speaker:in'
    )

    const expires = speaker.portal_token_expires ? new Date(speaker.portal_token_expires) : null
    const expired = expires !== null && !Number.isNaN(expires.getTime()) && expires <= now
    const link = expired
        ? 'Der Portal-Link ist inzwischen abgelaufen, für einen neuen Versuch bitte erneut ein Profil-Update anfragen.'
        : `Der Portal-Link ist weiterhin gültig${
              expires && !Number.isNaN(expires.getTime()) ? ` (bis ${formatDate(speaker.portal_token_expires!)})` : ''
          }, ein erneuter Versuch ist möglich.`

    const summary = report.message.replace(/[.\s]+$/, '')

    return (
        `:x: *Speaker Portal*: Das Profil-Update von ${name} konnte auf der Website nicht gespeichert werden ` +
        `(Schritt „${report.stage}“): ${summary}. ${link} ${itemUrl}`
    )
}
