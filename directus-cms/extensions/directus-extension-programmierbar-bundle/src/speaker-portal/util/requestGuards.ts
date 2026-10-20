/**
 * When a profile-update request may go out without the admin confirming it once more.
 *
 * Pure and dependency-free on purpose: the endpoint enforces these rules, and the admin interface
 * imports the same module to show the warning before the button is even clicked.
 */

/** Minimum time between two update requests to the same speaker, unless an admin forces it. */
export const PROFILE_UPDATE_COOLDOWN_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export type RequestBlockerCode = 'cooldown' | 'invitation_pending' | 'unreviewed_version'

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

/** The parts of a `profile-update` Content Version (`directus_versions`) the guards look at. */
export interface GuardedVersion {
    name?: string | null
    delta?: Record<string, unknown> | null
}

/**
 * Whether a version holds changes. Directus cannot tell an unreviewed version from one that was
 * promoted and kept (promoting does not delete it), so any delta counts.
 */
export function hasVersionChanges(version: GuardedVersion): boolean {
    const delta = version.delta
    return typeof delta === 'object' && delta !== null && Object.keys(delta).length > 0
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
 * Every reason a request needs an explicit "send anyway" (empty if it can go out right away). All of
 * them, not just the first: forcing overrides each one, so the admin has to see each.
 *
 * - `cooldown`: the speaker was already asked within the last {@link PROFILE_UPDATE_COOLDOWN_DAYS} days.
 * - `invitation_pending`: the regular portal invitation is still open. A new request would replace its
 *   token, so the link in the invitation would stop working.
 * - `unreviewed_version`: the speaker's `profile-update` version still holds changes. Every request
 *   starts with a fresh version, so sending deletes them.
 */
export function findRequestBlockers(
    speaker: GuardedSpeaker,
    now: Date = new Date(),
    versions: GuardedVersion[] = []
): RequestBlocker[] {
    const blockers: RequestBlocker[] = []

    if (isWithinCooldown(speaker.portal_update_requested_at, now)) {
        const last = parseDate(speaker.portal_update_requested_at)!
        blockers.push({
            code: 'cooldown',
            message:
                `Diese:r Speaker:in wurde zuletzt am ${formatDateDe(last)} um ein Profil-Update gebeten ` +
                `(weniger als ${PROFILE_UPDATE_COOLDOWN_DAYS} Tage her).`,
        })
    }

    const expires = parseDate(speaker.portal_token_expires)
    const invitationOpen =
        speaker.portal_submission_status === 'pending' &&
        Boolean(speaker.portal_token) &&
        (expires === null || expires > now)
    if (invitationOpen) {
        blockers.push({
            code: 'invitation_pending',
            message:
                'Die Einladung ins Speaker Portal ist noch offen. Eine Update-Anfrage ersetzt den Link aus der ' +
                'Einladung, der dann nicht mehr funktioniert.',
        })
    }

    const changed = versions.find(hasVersionChanges)
    if (changed) {
        const name = changed.name ? ` „${changed.name}“` : ''
        blockers.push({
            code: 'unreviewed_version',
            message:
                `Es gibt noch eine nicht übernommene Version${name} mit Änderungen der Speaker:in (oder sie wurde ` +
                'übernommen, aber nicht gelöscht). Eine neue Anfrage löscht diese Version.',
        })
    }

    return blockers
}
