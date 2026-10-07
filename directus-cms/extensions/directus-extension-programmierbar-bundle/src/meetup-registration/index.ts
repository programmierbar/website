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
} as const

function reject(kind: keyof typeof REJECTIONS): never {
    const { code, message } = REJECTIONS[kind]
    const HookError = createHookErrorConstructor(code, message, 409)
    throw new HookError()
}

const PUBLIC_CONFIRMED = { status: { _eq: 'confirmed' }, is_internal: { _neq: true } }

/** The m2o key, whether the payload carries the id or a nested object. */
function getMeetupKey(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id)
    return null
}

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
 *   address, still confirmed) resends the confirmation instead of inserting.
 *
 * action create — after the insert:
 *   sends the confirmation mail and reports 80 % / full to Slack.
 *
 * Cancelling (status → cancelled, via the website's cancel link) needs no hook.
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
                'full_name',
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
            fullName: registration.full_name,
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
     * Report to Slack when a registration takes the 80 % or the last public
     * spot. Uses the registration's position (by `date_created`) rather than the
     * current total, so two registrations committing back to back still report
     * each milestone exactly once.
     */
    async function reportMilestone(registration: any) {
        if (!registration || registration.status !== 'confirmed' || registration.is_internal) return

        const registrations = registrationsService(await getSchema())
        const meetup = registration.meetup
        const count = async (filter: Record<string, unknown>) => {
            const result = await registrations.readByQuery({
                filter: { meetup: { _eq: meetup.id }, ...filter },
                aggregate: { count: ['id'] },
            })
            return Number(result?.[0]?.count?.id ?? 0)
        }

        const position = await count({ ...PUBLIC_CONFIRMED, date_created: { _lte: registration.date_created } })
        const milestone = getCapacityMilestone(position, meetup.registration_limit)
        if (!milestone) return

        const total = await count({ status: { _eq: 'confirmed' } })
        const headline =
            milestone === 100
                ? `ist ausgebucht (${meetup.registration_limit} Plätze).`
                : `${position} von ${meetup.registration_limit} Plätzen sind vergeben (80 %).`
        await notifySlack(
            `:busts_in_silhouette: *Meetup „${meetup.title}“* ${headline} ` +
                `Fürs Catering zählen aktuell ${total} Anmeldungen inklusive interner.`
        )
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

        const database = context?.database
        const schema = context?.schema ?? (await getSchema())
        const options = { schema, accountability: { admin: true }, ...(database ? { knex: database } : {}) }

        // Serialize registrations per meetup for the rest of this transaction,
        // so the count below cannot go stale before the insert. Postgres only
        // (production); SQLite (local development) serializes writes anyway.
        if (database && ['pg', 'postgres', 'postgresql'].includes(database.client?.config?.client)) {
            await database.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`${COLLECTION}:${meetupKey}`])
        }

        const meetups = new services.ItemsService('meetups', options)
        const registrations = new services.ItemsService(COLLECTION, options)

        const [meetup] = await meetups.readByQuery({
            filter: { id: { _eq: meetupKey } },
            fields: ['status', 'start_on', 'registration_enabled', 'registration_limit'],
            limit: 1,
        })
        if (!meetup) {
            reject('disabled')
        }

        const counted = await registrations.readByQuery({
            filter: { meetup: { _eq: meetupKey }, ...PUBLIC_CONFIRMED },
            aggregate: { count: ['id'] },
        })
        const { state } = getMeetupRegistrationState(meetup, Number(counted?.[0]?.count?.id ?? 0))
        if (state === 'disabled' || state === 'closed') {
            reject(state)
        }

        // Checked before "full", so someone already registered gets their
        // confirmation again instead of being told the meetup is full.
        const [existing] = await registrations.readByQuery({
            filter: { meetup: { _eq: meetupKey }, email: { _eq: payload.email }, status: { _eq: 'confirmed' } },
            fields: ['id'],
            limit: 1,
        })
        if (existing) {
            // The existing row is committed, so this does not depend on the
            // rejected insert. Detached: the mail must not hold the lock.
            safeAction(HOOK_NAME, logger, async () => sendConfirmation(await readRegistration(existing.id)))(
                undefined,
                undefined
            )
            reject('duplicate')
        }

        // Internal registrations don't count against the public limit and are
        // still accepted when it is reached (catering counts everyone).
        if (state === 'full' && !payload.is_internal) {
            reject('full')
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
