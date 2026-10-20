import { SPEAKER_PORTAL_STATUS, SPEAKER_PROFILE_UPDATE_VERSION_KEY } from '../../../../../../shared-code/index.ts'

/**
 * How the submission confirmation tells a profile update apart from a first submission.
 *
 * Both end with the website writing `portal_submission_status = 'submitted'`; what differs is the
 * status BEFORE that write (`update_requested` vs. `pending`). An action hook only sees the new
 * payload, so a filter hook on the same update reads the old status and marks the speaker here, and
 * the action consumes the mark. Filter and action of one write run in the same process, one right
 * after the other; the TTL only cleans up marks whose write failed after the filter ran.
 */
export const PROFILE_UPDATE_MARK_TTL_MS = 5 * 60 * 1000

export interface ProfileUpdateTracker {
    /** Remember that this speaker's pending write submits a profile update. */
    mark(speakerId: string | number): void
    /** Whether the speaker was marked; removes the mark. */
    consume(speakerId: string | number): boolean
}

export function createProfileUpdateTracker(
    now: () => number = () => Date.now(),
    ttlMs: number = PROFILE_UPDATE_MARK_TTL_MS
): ProfileUpdateTracker {
    const marks = new Map<string, number>()

    function prune(): void {
        const cutoff = now() - ttlMs
        for (const [id, markedAt] of marks) {
            if (markedAt < cutoff) marks.delete(id)
        }
    }

    return {
        mark(speakerId) {
            prune()
            marks.set(String(speakerId), now())
        },
        consume(speakerId) {
            prune()
            return marks.delete(String(speakerId))
        },
    }
}

/** Keys of the rows (read before the write) that are answering a profile-update request. */
export function findProfileUpdateKeys(rows: Array<{ id: string | number; portal_submission_status?: string | null }>) {
    return rows
        .filter((row) => row.portal_submission_status === SPEAKER_PORTAL_STATUS.updateRequested)
        .map((row) => row.id)
}

export interface SubmissionMessageInput {
    speakerName: string
    podcastTitle?: string
    /** Admin URL of the speaker item (without a version selected). */
    itemUrl: string
    /** The submission answered a profile-update request; its changes are in a Content Version. */
    isProfileUpdate?: boolean
    /** Name of that version, if it could be read. */
    versionName?: string | null
}

/** The Slack text posted when a speaker submits the portal form. */
export function buildSubmissionSlackMessage(input: SubmissionMessageInput): string {
    const { speakerName, podcastTitle, itemUrl, isProfileUpdate, versionName } = input

    if (isProfileUpdate) {
        const key = SPEAKER_PROFILE_UPDATE_VERSION_KEY
        const versionLabel = versionName ? `„${versionName}“ (${key})` : `„${key}“`
        const versionUrl = `${itemUrl}?version=${encodeURIComponent(key)}`

        return (
            `:pencil2: *Speaker Portal – Profil-Update*: ${speakerName} hat das Profil geprüft und ein Update eingereicht. ` +
            `Die Änderungen liegen in der Content Version ${versionLabel} und sind noch NICHT live – ` +
            `bitte prüfen und übernehmen (Versions-Menü im Speaker → Version vergleichen → übernehmen): ${versionUrl}`
        )
    }

    const podcastInfo = podcastTitle ? ` für "${podcastTitle}"` : ''
    return `:white_check_mark: *Speaker Portal*: ${speakerName} hat die Informationen${podcastInfo} eingereicht. ${itemUrl}`
}
