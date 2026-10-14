import { defineHook } from '@directus/extensions-sdk'
import {
    getCalendarLinks,
    getFullSpeakerName,
    getMeetupCalendarEvent,
    getMeetupIcsPath,
    getMeetupRegistrationState,
    isInternalEmail,
    MEETUP_REGISTRATION_ERROR_CODES,
    normalizeEmail,
} from '../../../../../shared-code/index.ts'
import { sendRawEmail, type EmailServiceContext } from '../shared/email-service.ts'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import { getRequiredSetting } from '../shared/settings.ts'
import { buildConfirmationMail } from './util/confirmationMail.ts'
import { getCapacityMilestone } from './util/milestones.ts'

const HOOK_NAME = 'meetup-registration'
const COLLECTION = 'meetup_registrations'

const REJECTIONS = {
    disabled: {
        code: MEETUP_REGISTRATION_ERROR_CODES.disabled,
        message: 'Die Anmeldung für dieses Meetup ist nicht aktiv.',
    },
    closed: {
        code: MEETUP_REGISTRATION_ERROR_CODES.closed,
        message: 'Die Anmeldung für dieses Meetup ist geschlossen.',
    },
    full: { code: MEETUP_REGISTRATION_ERROR_CODES.full, message: 'Das Meetup ist ausgebucht.' },
    duplicate: {
        code: MEETUP_REGISTRATION_ERROR_CODES.duplicate,
        message: 'Diese E-Mail-Adresse ist für das Meetup schon angemeldet. Die Bestätigung wurde erneut gesendet.',
    },
    // An edit in the Directus app: nothing is resent there.
    duplicateUpdate: {
        code: MEETUP_REGISTRATION_ERROR_CODES.duplicate,
        message: 'Diese E-Mail-Adresse ist für das Meetup schon bestätigt angemeldet.',
    },
} as const

function reject(kind: keyof typeof REJECTIONS): never {
    const { code, message } = REJECTIONS[kind]
    const HookError = createHookErrorConstructor(code, message, 409)
    throw new HookError()
}

const PUBLIC_CONFIRMED = { status: { _eq: 'confirmed' }, is_internal: { _neq: true } }

const POSTGRES_CLIENTS = ['pg', 'postgres', 'postgresql']

/**
 * The m2o key, whether the payload carries the id or a nested object. Lowercased:
 * Postgres treats UUID spellings alike, so the lock key and the milestone
 * hand-over must too.
 */
function getMeetupKey(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number') return String(value).toLowerCase()
    if (value && typeof value === 'object' && 'id' in value) return getMeetupKey((value as { id: unknown }).id)
    return null
}

type Milestone = { milestone: 80 | 100; position: number }

/**
 * Free meetup registration (collection `meetup_registrations`, written by the
 * website's /api/meetup-registration/register route).
 *
 * filter create — inside the insert transaction:
 *   normalizes the email, sets `is_internal` from the company domain and the
 *   consent timestamp, then decides under a per-meetup lock whether the meetup
 *   takes the registration (disabled / closed at start / full / duplicate).
 *   The lock makes the limit hard: two concurrent registrations for the last
 *   spot are serialized instead of both passing a count. A duplicate (same
 *   address, still confirmed) resends the confirmation instead of inserting,
 *   and records a new meetup-updates opt-in on the existing row. Whether the
 *   registration reaches 80 % / full is decided here too, from the locked count.
 *
 * action create — after the insert:
 *   sends the confirmation mail and reports that milestone to Slack.
 *
 * filter update — an edit in the Directus app that makes a registration count
 *   for a meetup or take a public seat (unarchive to confirmed, moving a
 *   confirmed one, an internal address changed to a public one) passes the same
 *   checks, a corrected public address only the duplicate check; staff add late attendees by raising the
 *   limit. Cancelling (status → cancelled, also via the website's cancel link)
 *   always passes.
 */
export default defineHook(({ filter, action }, hookContext) => {
    const { logger, services, getSchema, env } = hookContext

    const emailContext: EmailServiceContext = { logger, services, getSchema }

    async function notifySlack(message: string) {
        try {
            await postSlackMessage(message)
        } catch (error: any) {
            logger.error(`${HOOK_NAME}: Slack notification failed: ${error?.message ?? error}`)
        }
    }

    function speakerImageUrl(fileId: unknown) {
        const publicUrl = typeof env?.PUBLIC_URL === 'string' ? env.PUBLIC_URL.replace(/\/$/, '') : ''
        return publicUrl && typeof fileId === 'string'
            ? `${publicUrl}/assets/${fileId}?width=112&height=112&fit=cover`
            : null
    }

    function registrationsService(schema: unknown) {
        return new services.ItemsService(COLLECTION, { schema, accountability: { admin: true } })
    }

    /** One read with everything the mail and the milestone report need. */
    async function readRegistration(key: string | number) {
        return await registrationsService(await getSchema()).readOne(key, {
            fields: [
                'id',
                'status',
                'is_internal',
                'date_created',
                'first_name',
                'email',
                'cancel_token',
                'wants_meetup_updates',
                'meetup.id',
                'meetup.slug',
                'meetup.title',
                'meetup.start_on',
                'meetup.end_on',
                'meetup.intro',
                'meetup.agenda',
                'meetup.speakers.sort',
                'meetup.speakers.speaker.academic_title',
                'meetup.speakers.speaker.first_name',
                'meetup.speakers.speaker.last_name',
                'meetup.speakers.speaker.occupation',
                'meetup.speakers.speaker.profile_image',
                'meetup.talks.sort',
                'meetup.talks.talk.title',
                'meetup.talks.talk.abstract',
                'meetup.registration_limit',
            ],
        })
    }

    /**
     * Record a meetup-updates opt-in given with a duplicate registration on the
     * existing row. Only ever adds consent: a resubmission without the checkbox
     * leaves an earlier opt-in alone. A failure goes to Slack, since the person
     * asked for invitations; the confirmation is still sent and then simply
     * does not mention them.
     */
    async function recordConsent(key: string | number, consentedAt: string) {
        try {
            await registrationsService(await getSchema()).updateOne(key, {
                wants_meetup_updates: true,
                meetup_updates_consented_at: consentedAt,
            })
        } catch (error: any) {
            logger.error(`${HOOK_NAME}: consent update for registration ${key} failed: ${error?.message ?? error}`)
            await notifySlack(
                `:warning: *Meetup-Anmeldung*: Einwilligung zu Meetup-Updates für Anmeldung ${key} ` +
                    `(erneute Anmeldung) nicht gespeichert: ${error?.message ?? error}.`
            )
        }
    }

    /**
     * Send the confirmation mail for one registration. Only confirmed rows are
     * mailed. Failures go to Slack: the person thinks they are registered and
     * would otherwise never get their cancel link.
     */
    async function sendConfirmation(registration: any) {
        if (!registration || registration.status !== 'confirmed') {
            logger.info(`${HOOK_NAME}: registration ${registration?.id} is not confirmed, no mail sent`)
            return
        }

        const meetup = registration.meetup
        const failure = (reason: string) =>
            notifySlack(
                `:warning: *Meetup-Anmeldung*: Bestätigungsmail für Anmeldung ${registration.id} ` +
                    `(Meetup „${meetup?.title ?? '?'}“) nicht gesendet: ${reason}.`
            )

        let websiteUrl: string
        try {
            websiteUrl = (await getRequiredSetting('website_url', emailContext)).replace(/\/$/, '')
        } catch {
            await failure("Setting 'website_url' ist nicht konfiguriert")
            return
        }

        const bySort = (a: { sort?: number | null }, b: { sort?: number | null }) => (a.sort ?? 0) - (b.sort ?? 0)
        const mail = buildConfirmationMail({
            firstName: registration.first_name,
            wantsMeetupUpdates: registration.wants_meetup_updates === true,
            meetup,
            talks: [...(meetup.talks ?? [])]
                .sort(bySort)
                .map((entry: any) => entry.talk)
                .filter((talk: any) => talk?.title),
            speakers: [...(meetup.speakers ?? [])]
                .sort(bySort)
                .map((entry: any) => entry.speaker)
                .filter(Boolean)
                .map((speaker: any) => ({
                    name: getFullSpeakerName(speaker),
                    occupation: speaker.occupation,
                    imageUrl: speakerImageUrl(speaker.profile_image),
                })),
            websiteUrl,
            cancelUrl: `${websiteUrl}/meetup/abmelden?token=${encodeURIComponent(registration.cancel_token)}`,
            calendarLinks: getCalendarLinks(
                getMeetupCalendarEvent(meetup, websiteUrl),
                `${websiteUrl}${getMeetupIcsPath(meetup.slug)}`
            ),
        })

        const sent = await sendRawEmail({ to: registration.email, ...mail }, emailContext)
        if (!sent) {
            await failure('Mailversand fehlgeschlagen, Details im Directus-Log')
        }
    }

    /**
     * Milestones decided in the create filter, handed to the create action.
     * Keyed by meetup and address, which is unique among confirmed
     * registrations. An insert that fails after the filter leaves a stale
     * entry: every accepted pass replaces its address's entry (so a retry never
     * re-announces it), and the map is capped.
     */
    const pendingMilestones = new Map<string, Milestone>()
    const milestoneKey = (meetupKey: string, email: string) => `${meetupKey}|${email}`

    function rememberMilestone(key: string, milestone: Milestone | null) {
        pendingMilestones.delete(key)
        if (!milestone) return
        pendingMilestones.set(key, milestone)
        while (pendingMilestones.size > 100) {
            pendingMilestones.delete(pendingMilestones.keys().next().value!)
        }
    }

    /**
     * Report to Slack when a registration took the 80 % or the last public
     * spot. The milestone itself comes from the locked count in the create
     * filter, so each one is reported exactly once even when registrations
     * commit back to back with the same `date_created`.
     */
    async function reportMilestone(registration: any) {
        const meetup = registration?.meetup
        const meetupKey = getMeetupKey(meetup?.id)
        if (!meetupKey || typeof registration.email !== 'string') return
        const key = milestoneKey(meetupKey, registration.email)
        const pending = pendingMilestones.get(key)
        pendingMilestones.delete(key)
        if (!pending || registration.status !== 'confirmed' || registration.is_internal) return

        const result = await registrationsService(await getSchema()).readByQuery({
            filter: { meetup: { _eq: meetup.id }, status: { _eq: 'confirmed' } },
            aggregate: { count: ['id'] },
        })
        const total = Number(result?.[0]?.count?.id ?? 0)
        const headline =
            pending.milestone === 100
                ? `ist ausgebucht (${meetup.registration_limit} Plätze).`
                : `${pending.position} von ${meetup.registration_limit} Plätzen sind vergeben (80 %).`
        await notifySlack(
            `:busts_in_silhouette: *Meetup „${meetup.title}“* ${headline} ` +
                `Fürs Catering zählen aktuell ${total} Anmeldungen inklusive interner.`
        )
    }

    function itemOptions(context: any, schema: unknown) {
        const database = context?.database
        return { schema, accountability: { admin: true }, ...(database ? { knex: database } : {}) }
    }

    /**
     * Serialize registrations per meetup for the rest of the transaction, so a
     * count cannot go stale before the write. Postgres only (production); SQLite
     * (local development) serializes writes anyway.
     */
    async function lockMeetup(database: any, meetupKey: string) {
        if (database && POSTGRES_CLIENTS.includes(database.client?.config?.client)) {
            await database.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`${COLLECTION}:${meetupKey}`])
        }
    }

    /**
     * Read the meetup and its public confirmed count; rejects when the meetup
     * takes no registrations at all. `pending` counts public registrations of
     * the same write that are not in the table yet (a bulk unarchive).
     */
    async function readMeetupCapacity(meetupKey: string, options: Record<string, unknown>, pending = 0) {
        const [meetup] = await new services.ItemsService('meetups', options).readByQuery({
            filter: { id: { _eq: meetupKey } },
            fields: ['status', 'start_on', 'registration_enabled', 'registration_limit'],
            limit: 1,
        })
        if (!meetup) {
            reject('disabled')
        }

        const counted = await new services.ItemsService(COLLECTION, options).readByQuery({
            filter: { meetup: { _eq: meetupKey }, ...PUBLIC_CONFIRMED },
            aggregate: { count: ['id'] },
        })
        const publicCount = Number(counted?.[0]?.count?.id ?? 0) + pending
        const { state } = getMeetupRegistrationState(meetup, publicCount)
        if (state === 'disabled' || state === 'closed') {
            reject(state)
        }
        return { state, publicCount, limit: meetup.registration_limit as number | null }
    }

    /** A confirmed registration of `email` for the meetup, other than `excludeId`. */
    async function findConfirmed(
        options: Record<string, unknown>,
        meetupKey: string,
        email: string,
        fields: string[],
        excludeId?: string | number
    ) {
        const [row] = await new services.ItemsService(COLLECTION, options).readByQuery({
            filter: {
                meetup: { _eq: meetupKey },
                email: { _eq: email },
                status: { _eq: 'confirmed' },
                ...(excludeId !== undefined ? { id: { _neq: excludeId } } : {}),
            },
            fields,
            limit: 1,
        })
        return row as Record<string, any> | undefined
    }

    filter(`${COLLECTION}.items.create`, async (input: any, _meta: any, context: any) => {
        const payload = { ...(input ?? {}) }
        const meetupKey = getMeetupKey(payload.meetup)
        // Required fields are enforced by Directus itself; nothing to decide without them.
        if (!meetupKey || typeof payload.email !== 'string') {
            return payload
        }

        // Explicit rather than relying on the field default alone: every rule
        // below and the confirmation mail key off 'confirmed'.
        payload.status = payload.status ?? 'confirmed'
        payload.email = normalizeEmail(payload.email)
        payload.is_internal = isInternalEmail(payload.email)
        payload.meetup_updates_consented_at = payload.wants_meetup_updates === true ? new Date().toISOString() : null

        const options = itemOptions(context, context?.schema ?? (await getSchema()))
        await lockMeetup(context?.database, meetupKey)
        const { state, publicCount, limit } = await readMeetupCapacity(meetupKey, options)
        // Internal registrations don't count against the public limit and are
        // still accepted when it is reached (catering counts everyone).
        const fullForThisAddress = state === 'full' && !payload.is_internal

        // Checked before "full", so someone already registered gets their
        // confirmation again even when the meetup is full.
        const existing = await findConfirmed(options, meetupKey, payload.email, ['id', 'wants_meetup_updates'])
        if (existing) {
            // The existing row is committed, so this does not depend on the
            // rejected insert. Detached: the mail must not hold the lock, and
            // the consent update must not be rolled back with the insert.
            const newConsentAt = existing.wants_meetup_updates !== true ? payload.meetup_updates_consented_at : null
            safeAction(HOOK_NAME, logger, async () => {
                if (newConsentAt) await recordConsent(existing.id, newConsentAt)
                await sendConfirmation(await readRegistration(existing.id))
            })(undefined, undefined)
            // When full, answer exactly as for an unregistered address, so the
            // response does not reveal who is registered; the mail stays private.
            reject(fullForThisAddress ? 'full' : 'duplicate')
        }

        if (fullForThisAddress) {
            reject('full')
        }

        const position = publicCount + 1
        const milestone =
            payload.status === 'confirmed' && !payload.is_internal ? getCapacityMilestone(position, limit) : null
        rememberMilestone(milestoneKey(meetupKey, payload.email), milestone ? { milestone, position } : null)

        return payload
    })

    filter(`${COLLECTION}.items.update`, async (input: any, meta: any, context: any) => {
        const payload = { ...(input ?? {}) }
        // Cancelling always passes; edits that touch neither status, meetup nor
        // address (notes, consent) cannot change who counts.
        if (payload.status !== undefined && payload.status !== 'confirmed') return payload
        if (payload.status === undefined && payload.meetup === undefined && payload.email === undefined) return payload
        const keys: (string | number)[] = Array.isArray(meta?.keys) ? meta.keys : []
        if (keys.length === 0) return payload

        if (typeof payload.email === 'string') {
            payload.email = normalizeEmail(payload.email)
            payload.is_internal = isInternalEmail(payload.email)
        }

        // Directus runs the update filter before its transaction, so the lock
        // below only waits for registrations in flight; an edit in the app is
        // rare enough that the remaining window does not matter.
        const options = itemOptions(context, context?.schema ?? (await getSchema()))
        const rows: any[] = await new services.ItemsService(COLLECTION, options).readMany(keys, {
            fields: ['id', 'status', 'meetup', 'email', 'is_internal'],
        })

        const joined = new Map<string, number>() // public rows this write adds per meetup
        const addresses = new Set<string>() // meetup|email confirmed by this write
        for (const row of rows) {
            const status = payload.status ?? row.status
            const meetupKey = getMeetupKey(payload.meetup ?? row.meetup)
            const email = payload.email ?? row.email
            if (status !== 'confirmed' || !meetupKey || typeof email !== 'string') continue

            const heldSpot = row.status === 'confirmed' && getMeetupKey(row.meetup) === meetupKey
            if (heldSpot && email === row.email) continue

            await lockMeetup(context?.database, meetupKey)
            const address = milestoneKey(meetupKey, email)
            if (addresses.has(address) || (await findConfirmed(options, meetupKey, email, ['id'], row.id))) {
                reject('duplicateUpdate')
            }
            addresses.add(address)

            // A public seat is taken by joining the meetup as a public address,
            // and also by turning an internal registration public (new address).
            // Correcting a public address keeps its seat: duplicate check only.
            const isInternal = payload.is_internal ?? row.is_internal
            const takesPublicSeat = !isInternal && !(heldSpot && !row.is_internal)
            if (!heldSpot || takesPublicSeat) {
                const { state } = await readMeetupCapacity(meetupKey, options, joined.get(meetupKey) ?? 0)
                if (takesPublicSeat) {
                    if (state === 'full') reject('full')
                    joined.set(meetupKey, (joined.get(meetupKey) ?? 0) + 1)
                }
            }
        }
        return payload
    })

    action(
        `${COLLECTION}.items.create`,
        safeAction(HOOK_NAME, logger, async (metadata: any) => {
            const key = metadata?.key
            if (key === undefined || key === null) {
                logger.warn(`${HOOK_NAME}: create action fired without a key; skipping`)
                return
            }
            const registration = await readRegistration(key)
            await sendConfirmation(registration)
            await reportMilestone(registration)
        })
    )

    logger.info(`${HOOK_NAME} hook registered`)
})
