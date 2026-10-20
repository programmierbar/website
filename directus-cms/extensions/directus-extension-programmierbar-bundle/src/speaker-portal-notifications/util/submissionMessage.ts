/**
 * How the submission confirmation tells a profile update apart from a first submission.
 *
 * In update mode the website saves the speaker's changes into the `profile-update` Content Version
 * and only then marks the live item as submitted. So a profile update is a submission whose version
 * was saved moments ago. An older version (e.g. one an admin kept after promoting it) does not count:
 * a later first-time submission would otherwise be announced as a profile update.
 */
export const PROFILE_UPDATE_VERSION_MAX_AGE_MS = 10 * 60 * 1000

export interface ProfileUpdateVersion {
    key: string
    name: string | null
    date_created?: string | null
    date_updated?: string | null
}

export function isFreshProfileUpdateVersion(
    version: ProfileUpdateVersion | null | undefined,
    now: Date = new Date()
): version is ProfileUpdateVersion {
    const savedAt = version?.date_updated ?? version?.date_created
    if (!savedAt) {
        return false
    }

    const age = now.getTime() - new Date(savedAt).getTime()
    // A little tolerance for clock skew between the database and the CMS process.
    return Number.isFinite(age) && age >= -60 * 1000 && age <= PROFILE_UPDATE_VERSION_MAX_AGE_MS
}

export interface SubmissionMessageInput {
    speakerName: string
    podcastTitle?: string
    /** Admin URL of the speaker item (without a version selected). */
    itemUrl: string
    /** Set when the submission was a profile update saved into a Content Version. */
    profileUpdateVersion?: ProfileUpdateVersion | null
}

/** The Slack text posted when a speaker submits the portal form. */
export function buildSubmissionSlackMessage(input: SubmissionMessageInput): string {
    const { speakerName, podcastTitle, itemUrl, profileUpdateVersion } = input

    if (profileUpdateVersion) {
        const versionLabel = profileUpdateVersion.name
            ? `„${profileUpdateVersion.name}“ (${profileUpdateVersion.key})`
            : `„${profileUpdateVersion.key}“`
        const versionUrl = `${itemUrl}?version=${encodeURIComponent(profileUpdateVersion.key)}`

        return (
            `:pencil2: *Speaker Portal – Profil-Update*: ${speakerName} hat das Profil geprüft und ein Update eingereicht. ` +
            `Die Änderungen liegen in der Content Version ${versionLabel} und sind noch NICHT live – ` +
            `bitte prüfen und übernehmen (Versions-Menü im Speaker → Version vergleichen → übernehmen): ${versionUrl}`
        )
    }

    const podcastInfo = podcastTitle ? ` für "${podcastTitle}"` : ''
    return `:white_check_mark: *Speaker Portal*: ${speakerName} hat die Informationen${podcastInfo} eingereicht. ${itemUrl}`
}
