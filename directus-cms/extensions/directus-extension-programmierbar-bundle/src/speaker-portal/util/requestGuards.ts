/**
 * When a profile-update request may go out without the admin confirming it once more.
 *
 * Pure and dependency-free on purpose: the endpoint enforces these rules, and the admin interface
 * imports the same module to show the warning before the button is even clicked.
 */

/** Minimum time between two update requests to the same speaker, unless an admin forces it. */
export const PROFILE_UPDATE_COOLDOWN_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export type RequestBlockerCode = 'cooldown' | 'invitation_pending'

export interface RequestBlocker {
    code: RequestBlockerCode
    message: string
}

export interface GuardedSpeaker {
    portal_submission_status?: string | null
    portal_token?: string | null
    portal_token_expires?: string | null
    portal_update_requested_at?: string | null
}

function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateDe(date: Date): string {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** The moment the cooldown after the last request ends, or `null` if there was no request. */
export function getCooldownEnd(lastRequestedAt: string | null | undefined): Date | null {
    const last = parseDate(lastRequestedAt)
    return last ? new Date(last.getTime() + PROFILE_UPDATE_COOLDOWN_DAYS * DAY_MS) : null
}

export function isWithinCooldown(lastRequestedAt: string | null | undefined, now: Date = new Date()): boolean {
    const end = getCooldownEnd(lastRequestedAt)
    return end !== null && now < end
}

/**
 * The reason a request needs an explicit "send anyway", or `null` if it can go out right away.
 *
 * - `cooldown`: the speaker was already asked within the last {@link PROFILE_UPDATE_COOLDOWN_DAYS} days.
 * - `invitation_pending`: the regular portal invitation is still open. A new request would replace its
 *   token, so the link in the invitation would stop working.
 */
export function findRequestBlocker(speaker: GuardedSpeaker, now: Date = new Date()): RequestBlocker | null {
    if (isWithinCooldown(speaker.portal_update_requested_at, now)) {
        const last = parseDate(speaker.portal_update_requested_at)!
        return {
            code: 'cooldown',
            message:
                `Diese:r Speaker:in wurde zuletzt am ${formatDateDe(last)} um ein Profil-Update gebeten ` +
                `(weniger als ${PROFILE_UPDATE_COOLDOWN_DAYS} Tage her).`,
        }
    }

    const expires = parseDate(speaker.portal_token_expires)
    const invitationOpen =
        speaker.portal_submission_status === 'pending' &&
        Boolean(speaker.portal_token) &&
        (expires === null || expires > now)
    if (invitationOpen) {
        return {
            code: 'invitation_pending',
            message:
                'Die Einladung ins Speaker Portal ist noch offen. Eine Update-Anfrage ersetzt den Link aus der ' +
                'Einladung, der dann nicht mehr funktioniert.',
        }
    }

    return null
}
