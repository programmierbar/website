import { SPEAKER_PORTAL_STATUS } from '../../../../../../shared-code/index.ts'

/**
 * The profile-update flow depends on schema changes that are made by hand in the Directus Data
 * Model UI, not by this bundle. Writing to a field that does not exist is silently dropped by
 * Directus, so the endpoint checks them up front and refuses loudly instead of half-working.
 */

export const PROFILE_UPDATE_TEMPLATE_KEY = 'speaker_profile_update_request'

export interface ProfileUpdateSetup {
    /** `speakers.portal_update_requested_at` exists. */
    hasRequestedAtField: boolean
    /** Content Versioning is enabled on `speakers`. */
    versioningEnabled: boolean
    /** Choices configured on `speakers.portal_submission_status`. */
    statusChoices: string[]
    /** The `speaker_profile_update_request` row exists in `email_templates`. */
    hasTemplate: boolean
}

/** Human-readable list of what is missing (empty when the setup is complete). */
export function findMissingSetup(setup: ProfileUpdateSetup): string[] {
    const missing: string[] = []

    if (!setup.versioningEnabled) {
        missing.push('Content Versioning ist für „speakers“ nicht aktiviert')
    }
    if (!setup.statusChoices.includes(SPEAKER_PORTAL_STATUS.updateRequested)) {
        missing.push(`„portal_submission_status“ hat keine Auswahl „${SPEAKER_PORTAL_STATUS.updateRequested}“`)
    }
    if (!setup.hasRequestedAtField) {
        missing.push('Feld „speakers.portal_update_requested_at“ fehlt')
    }
    if (!setup.hasTemplate) {
        missing.push(`E-Mail-Template „${PROFILE_UPDATE_TEMPLATE_KEY}“ fehlt`)
    }

    return missing
}

/** Choice values of a select field's `meta.options.choices`, tolerant of a missing config. */
export function choiceValues(fieldMeta: any): string[] {
    const choices = fieldMeta?.options?.choices
    if (!Array.isArray(choices)) {
        return []
    }
    return choices
        .map((choice: any) => (typeof choice === 'string' ? choice : choice?.value))
        .filter((value: unknown): value is string => typeof value === 'string')
}
