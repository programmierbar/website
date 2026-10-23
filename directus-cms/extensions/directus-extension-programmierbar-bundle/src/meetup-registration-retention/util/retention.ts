/**
 * Retention rules for `meetup_registrations`.
 *
 * Registrations are kept only for organising the meetup (confirmation, reminder,
 * headcount) and its follow-up (materials, survey). After that the personal data
 * is removed and only anonymised statistics stay. The deadline is also stated in
 * the privacy policy, which is maintained separately in the `privacy_page`
 * content — change both together.
 */

/** Days after the meetup (its end, else its start) after which registrations are anonymised. */
export const MEETUP_REGISTRATION_RETENTION_DAYS = 60

/** Registrations read and anonymised per transaction. */
export const RETENTION_BATCH_SIZE = 100

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * What an anonymised text field is set to. `first_name`, `last_name` and `email`
 * are NOT NULL (and required) in the schema, so an empty string is the value
 * that carries no information without a schema change.
 */
export const ANONYMISED_TEXT = ''

/** Personal fields that are cleared to `null` (all nullable). */
export const NULLABLE_PERSONAL_FIELDS = [
    'pronouns',
    'job_title',
    'company',
    'heard_about_other', // free text, may identify the person
    'cancelled_at',
] as const

/** Personal fields that are NOT NULL and therefore cleared to {@link ANONYMISED_TEXT}. */
export const REQUIRED_PERSONAL_FIELDS = ['last_name'] as const

/**
 * Kept while the person has consented to invitations (`wants_meetup_updates`):
 * the address and the consent timestamp as proof of the opt-in, the first name
 * for a personal greeting. Without consent they are cleared to these values.
 */
export const CONSENT_FIELDS = {
    first_name: ANONYMISED_TEXT,
    email: ANONYMISED_TEXT,
    meetup_updates_consented_at: null,
} as const

/**
 * Fields read per registration: everything {@link needsAnonymisation} looks at.
 * Statistics (`heard_about_from`, `has_meetup_account`, `is_internal`, `status`,
 * `meetup`, `date_created`) are never read or written.
 */
export const REGISTRATION_FIELDS = [
    'id',
    ...REQUIRED_PERSONAL_FIELDS,
    ...NULLABLE_PERSONAL_FIELDS,
    'first_name',
    'email',
    'meetup_updates_consented_at',
    'wants_meetup_updates',
] as const

const CONSENT_FIELD_NAMES = Object.keys(CONSENT_FIELDS) as Array<keyof typeof CONSENT_FIELDS>

export interface RetentionMeetup {
    id: string
    start_on: string | Date | null
    end_on?: string | Date | null
}

export type RetentionRegistration = { id: string } & Partial<
    Record<Exclude<(typeof REGISTRATION_FIELDS)[number], 'id'>, unknown>
>

/** Meetups whose end (or start) lies before this moment are past the retention period. */
export function getRetentionCutoff(now: Date, days: number = MEETUP_REGISTRATION_RETENTION_DAYS): Date {
    return new Date(now.getTime() - days * DAY_IN_MS)
}

/** When the meetup ended: `end_on`, else `start_on`; `null` when neither is a valid date. */
export function getMeetupEnd(meetup: RetentionMeetup): Date | null {
    for (const value of [meetup.end_on, meetup.start_on]) {
        if (value === null || value === undefined || value === '') continue
        const date = new Date(value)
        if (Number.isFinite(date.getTime())) return date
    }
    return null
}

/** A meetup without any date is never selected: we cannot tell when it took place. */
export function isPastRetention(meetup: RetentionMeetup, cutoff: Date): boolean {
    const end = getMeetupEnd(meetup)
    return end !== null && end.getTime() < cutoff.getTime()
}

/**
 * Invitation consent is the only reason to keep anything personal
 * ({@link CONSENT_FIELDS}), until it moves to the "Meetups" list of the
 * newsletter system.
 */
export function keepsConsentProof(registration: RetentionRegistration): boolean {
    return registration.wants_meetup_updates === true
}

function hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && value !== ANONYMISED_TEXT
}

/** False once a registration has been anonymised, so every run can safely look at it again. */
export function needsAnonymisation(registration: RetentionRegistration): boolean {
    if (REQUIRED_PERSONAL_FIELDS.some((field) => hasValue(registration[field]))) return true
    if (NULLABLE_PERSONAL_FIELDS.some((field) => hasValue(registration[field]))) return true
    if (!keepsConsentProof(registration)) {
        return CONSENT_FIELD_NAMES.some((field) => hasValue(registration[field]))
    }
    return false
}

/**
 * The update that anonymises a registration.
 *
 * `cancel_token` is NOT NULL as well; it is replaced by a fresh, unrelated UUID
 * so the link in the confirmation mail no longer points at the row.
 *
 * TODO: once invitation consent lives in the "Meetups" list of the newsletter
 * system, move `first_name`, `email` and the consent of rows with
 * `wants_meetup_updates = true` there and drop the exception below, so
 * {@link CONSENT_FIELDS} are always cleared.
 */
export function buildAnonymisationPatch(
    registration: RetentionRegistration,
    newCancelToken: string
): Record<string, string | null> {
    const patch: Record<string, string | null> = { cancel_token: newCancelToken }
    for (const field of REQUIRED_PERSONAL_FIELDS) patch[field] = ANONYMISED_TEXT
    for (const field of NULLABLE_PERSONAL_FIELDS) patch[field] = null
    if (!keepsConsentProof(registration)) {
        for (const field of CONSENT_FIELD_NAMES) patch[field] = CONSENT_FIELDS[field]
    }
    return patch
}

export interface RegistrationUpdate {
    id: string
    patch: Record<string, string | null>
}

/** Database access of a run, injected so the run itself can be tested without a database. */
export interface RetentionRepository {
    /** All meetups that may be past the cutoff (a superset is fine, {@link isPastRetention} decides). */
    readMeetupCandidates(cutoff: Date): Promise<RetentionMeetup[]>
    /** Registrations of these meetups ordered by `id`, starting after `afterId`. */
    readRegistrations(meetupIds: string[], afterId: string | null, limit: number): Promise<RetentionRegistration[]>
    /** Applies the updates in one transaction and purges the rows' revisions. */
    anonymise(updates: RegistrationUpdate[]): Promise<void>
}

export interface RetentionResult {
    meetups: number
    scanned: number
    anonymised: number
    keptForConsent: number
}

/** Thrown when a run fails part-way; earlier batches are committed and counted in `result`. */
export class RetentionRunError extends Error {
    constructor(
        cause: unknown,
        public readonly result: RetentionResult
    ) {
        super(cause instanceof Error ? cause.message : String(cause))
    }
}

/**
 * Anonymise every registration of a meetup past the retention period.
 *
 * Idempotent: rows that are already anonymised are skipped, so a run after a
 * failure simply continues. Each batch is its own transaction; the keyset
 * pagination by `id` guarantees the run ends even if an update would not stick.
 */
export async function anonymiseExpiredRegistrations(
    repository: RetentionRepository,
    options: { now: Date; createToken: () => string; batchSize?: number }
): Promise<RetentionResult> {
    const { now, createToken, batchSize = RETENTION_BATCH_SIZE } = options
    const result: RetentionResult = { meetups: 0, scanned: 0, anonymised: 0, keptForConsent: 0 }

    try {
        const cutoff = getRetentionCutoff(now)
        const meetupIds = (await repository.readMeetupCandidates(cutoff))
            .filter((meetup) => isPastRetention(meetup, cutoff))
            .map((meetup) => meetup.id)
        result.meetups = meetupIds.length
        if (meetupIds.length === 0) return result

        let afterId: string | null = null
        for (;;) {
            const batch = await repository.readRegistrations(meetupIds, afterId, batchSize)
            if (batch.length === 0) break
            result.scanned += batch.length
            afterId = batch[batch.length - 1]?.id ?? null

            const pending = batch.filter(needsAnonymisation)
            if (pending.length > 0) {
                await repository.anonymise(
                    pending.map((row) => ({ id: row.id, patch: buildAnonymisationPatch(row, createToken()) }))
                )
                result.anonymised += pending.length
                result.keptForConsent += pending.filter(keepsConsentProof).length
            }

            if (batch.length < batchSize) break
        }
        return result
    } catch (error) {
        throw new RetentionRunError(error, result)
    }
}
