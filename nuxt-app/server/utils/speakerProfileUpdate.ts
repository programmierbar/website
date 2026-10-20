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
    'findContentVersion' | 'createContentVersion' | 'renameContentVersion' | 'saveToContentVersion'
>

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
 * Save a speaker's submitted profile into their `profile-update` Content Version, creating it on
 * the first update and reusing (and renaming) it afterwards, so a speaker never has more than one
 * pending update. All submitted fields are saved, not just the changed ones: Directus shows the
 * differences to the live item when the version is compared, and promoting an unchanged value is a
 * no-op.
 */
export async function saveSpeakerProfileUpdate(
    directus: VersionClient,
    speakerId: string,
    profile: Record<string, unknown>,
    now: Date = new Date()
): Promise<DirectusContentVersion> {
    const name = getProfileUpdateVersionName(now)

    let version = await directus.findContentVersion('speakers', speakerId, SPEAKER_PROFILE_UPDATE_VERSION_KEY)
    if (!version) {
        version = await directus.createContentVersion({
            key: SPEAKER_PROFILE_UPDATE_VERSION_KEY,
            name,
            collection: 'speakers',
            item: speakerId,
        })
    } else if (version.name !== name) {
        await directus.renameContentVersion(version.id, name)
        version = { ...version, name }
    }

    await directus.saveToContentVersion(version.id, profile)

    return version
}
