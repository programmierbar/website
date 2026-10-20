import type { DirectusContentVersion } from '~/types/directus'
import { SPEAKER_PORTAL_STATUS, SPEAKER_PROFILE_UPDATE_VERSION_KEY } from 'shared-code'
import type { useAuthenticatedDirectus } from './authenticatedDirectus'

// A speaker the CMS asked to check an existing profile (`update_requested`) edits the same form as a
// new speaker, but the result must not go live unreviewed: it is saved into the speaker's
// `profile-update` Content Version, which an admin compares and promotes in Directus.

export type SpeakerPortalMode = 'initial' | 'update'

/** The portal answers 409 once a speaker has submitted (or was approved): the link is used up. */
export function isSpeakerPortalClosed(status: string | null | undefined): boolean {
    return status === SPEAKER_PORTAL_STATUS.submitted || status === SPEAKER_PORTAL_STATUS.approved
}

export function getSpeakerPortalMode(status: string | null | undefined): SpeakerPortalMode {
    return status === SPEAKER_PORTAL_STATUS.updateRequested ? 'update' : 'initial'
}

type VersionClient = Pick<
    ReturnType<typeof useAuthenticatedDirectus>,
    'findContentVersion' | 'createContentVersion' | 'saveToContentVersion'
>

/** The image fields the portal only sends when the speaker uploads a replacement. */
const SPEAKER_IMAGE_FIELDS = ['profile_image', 'event_image'] as const

/** The live speaker as far as saving an update needs it; image fields may be ids or expanded files. */
export interface ProfileUpdateSpeaker {
    id: string
    profile_image?: unknown
    event_image?: unknown
}

function fileId(value: unknown): string | null {
    if (typeof value === 'string') return value
    const id = (value as { id?: unknown } | null | undefined)?.id
    return typeof id === 'string' ? id : null
}

/** Shown in the version menu in Directus; dated so an admin sees which submission it holds. */
export function getProfileUpdateVersionName(date: Date): string {
    const formatted = date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Berlin',
    })
    return `Profil-Update ${formatted}`
}

/**
 * Save a speaker's submitted profile into their `profile-update` Content Version. All submitted
 * fields are saved, not just the changed ones: Directus shows the differences to the live item when
 * the version is compared, and promoting an unchanged value is a no-op.
 *
 * Normally this creates the version: the CMS deletes any earlier one when it sends the update
 * request, because saving merges into a version's delta and a kept version would carry fields from
 * an earlier answer into the next promote. A version that already exists belongs to the current
 * request (an earlier attempt that failed after creating it) and is saved into as a fallback, since
 * Directus allows only one version per key and item. Its delta may still hold an image from that
 * attempt, so an image the speaker did not replace this time is reset to the live one there.
 */
export async function saveSpeakerProfileUpdate(
    directus: VersionClient,
    speaker: ProfileUpdateSpeaker,
    profile: Record<string, unknown>,
    now: Date = new Date()
): Promise<DirectusContentVersion> {
    const existing = await directus.findContentVersion('speakers', speaker.id, SPEAKER_PROFILE_UPDATE_VERSION_KEY)

    if (!existing) {
        const version = await directus.createContentVersion({
            key: SPEAKER_PROFILE_UPDATE_VERSION_KEY,
            name: getProfileUpdateVersionName(now),
            collection: 'speakers',
            item: speaker.id,
        })
        await directus.saveToContentVersion(version.id, profile)
        return version
    }

    const delta = { ...profile }
    for (const field of SPEAKER_IMAGE_FIELDS) {
        if (!(field in delta)) delta[field] = fileId(speaker[field])
    }
    await directus.saveToContentVersion(existing.id, delta)
    return existing
}

/** Stages the website reports to the CMS when a profile update cannot be saved. */
export const SPEAKER_PROFILE_UPDATE_FAILURE_STAGE = {
    saveVersion: 'save_version',
} as const

const FAILURE_SUMMARY_MAX_LENGTH = 300

/**
 * A short summary of an error for the team's Slack message. The Directus SDK rejects with
 * `{ errors: [{ message }] }` rather than an `Error`. The CMS sanitises the text again before posting.
 */
export function summarizeError(err: unknown): string {
    const errors = (err as { errors?: unknown } | null | undefined)?.errors
    const fromDirectus = Array.isArray(errors)
        ? errors
              .map((e: { message?: unknown } | null) => (typeof e?.message === 'string' ? e.message : ''))
              .filter(Boolean)
              .join('; ')
        : ''
    const message =
        fromDirectus ||
        (err instanceof Error ? err.message : typeof err === 'string' ? err : '') ||
        'Unbekannter Fehler'
    return message.length > FAILURE_SUMMARY_MAX_LENGTH ? message.slice(0, FAILURE_SUMMARY_MAX_LENGTH) : message
}

/**
 * Tell the team (through the CMS, which posts to Slack) that a speaker's profile update could not be
 * saved. Never throws: the speaker gets the same error either way, and a failed report is only logged.
 */
export async function reportSpeakerProfileUpdateFailure(
    directus: Pick<ReturnType<typeof useAuthenticatedDirectus>, 'reportSpeakerProfileUpdateFailure'>,
    speakerId: string,
    stage: string,
    err: unknown
): Promise<void> {
    try {
        await directus.reportSpeakerProfileUpdateFailure(speakerId, { stage, message: summarizeError(err) })
    } catch (reportErr) {
        console.error('Speaker portal: could not report the failed profile update to the CMS:', reportErr)
    }
}
