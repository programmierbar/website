import { defineEndpoint } from '@directus/extensions-sdk'
import { SPEAKER_PORTAL_STATUS } from '../../../../../shared-code/index.ts'
import {
    formatDateGerman,
    getEmailTemplate,
    sendTemplatedEmail,
    type EmailServiceContext,
} from '../shared/email-service.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { getSetting } from '../shared/settings.ts'
import { buildPortalUrl, buildPublicProfileUrl, createPortalToken } from '../shared/speakerPortal.ts'
import { renderProfileOverview, SPEAKER_LINK_FIELDS } from './util/profileOverview.ts'
import { findRequestBlocker } from './util/requestGuards.ts'
import { choiceValues, findMissingSetup, PROFILE_UPDATE_TEMPLATE_KEY } from './util/setupCheck.ts'

const ENDPOINT_NAME = 'speaker-portal'

const SPEAKER_FIELDS = [
    'id',
    'status',
    'slug',
    'email',
    'academic_title',
    'first_name',
    'last_name',
    'occupation',
    'description',
    'profile_image',
    'event_image',
    ...SPEAKER_LINK_FIELDS.map(([field]) => field),
    'portal_submission_status',
    'portal_token',
    'portal_token_expires',
    'portal_update_requested_at',
]

/**
 * Admin actions for the speaker portal, called from the `speaker-profile-update-actions`
 * interface on the speaker item page (same pattern as `invoice-lifecycle` / `invoice-actions`).
 *
 * - POST /speaker-portal/:id/request-update — ask an existing speaker by mail whether their
 *   profile is still up to date. Body: `{ force?: boolean }`.
 *
 *   Issues a fresh portal token (same validity as a new speaker's invitation), sets
 *   `portal_submission_status = 'update_requested'` and `portal_update_requested_at = now`, and
 *   sends the `speaker_profile_update_request` template with a profile overview, the public
 *   profile link and the portal link. The website then saves the speaker's edits into a Content
 *   Version instead of the live item.
 *
 *   Refuses with 409 (`code: 'cooldown' | 'invitation_pending'`) unless `force` is set, when the
 *   speaker was asked within the cooldown or their regular invitation is still open.
 *
 *   The token write runs with `emitEvents: false`: it is not a profile change, so none of the
 *   `speakers.items.update` hooks has anything to do. In particular the invitation in
 *   `speaker-portal-notifications` must not fire for it (it would also skip on its own, since it
 *   only sends while the status is `pending`, and the daily reminders only select `pending`).
 */
export default defineEndpoint((router, context) => {
    const { logger, services, getSchema, env } = context
    const { ItemsService } = services

    class HttpError extends Error {
        status: number
        body: Record<string, unknown>
        constructor(status: number, message: string, body: Record<string, unknown> = {}) {
            super(message)
            this.status = status
            this.body = body
        }
    }

    async function notifySlack(text: string): Promise<void> {
        try {
            await postSlackMessage(text)
        } catch (err: any) {
            logger.error(`${ENDPOINT_NAME}: Failed to send Slack notification: ${err?.message || err}`)
        }
    }

    async function findMissing(schema: any, emailContext: EmailServiceContext): Promise<string[]> {
        const accountability = emailContext.accountability
        const collectionsService = new services.CollectionsService({ schema, accountability })
        const fieldsService = new services.FieldsService({ schema, accountability })

        const [collection, statusField, template] = await Promise.all([
            collectionsService.readOne('speakers'),
            fieldsService.readOne('speakers', 'portal_submission_status'),
            getEmailTemplate(PROFILE_UPDATE_TEMPLATE_KEY, emailContext),
        ])

        return findMissingSetup({
            hasRequestedAtField: Boolean(schema?.collections?.speakers?.fields?.portal_update_requested_at),
            versioningEnabled: collection?.meta?.versioning === true,
            statusChoices: choiceValues(statusField?.meta),
            hasTemplate: template !== null,
        })
    }

    router.post('/:id/request-update', async (req: any, res: any) => {
        // Sends mail to a speaker and replaces their portal link: admins only.
        if (req.accountability?.admin !== true) {
            res.status(403).send({ error: 'Admin access required' })
            return
        }

        const speakerId = req.params.id
        const force = req.body?.force === true
        const itemUrl = `${env.PUBLIC_URL}admin/content/speakers/${speakerId}`

        try {
            const schema = await getSchema()
            const emailContext: EmailServiceContext = {
                logger,
                services,
                getSchema,
                accountability: req.accountability,
            }

            const missing = await findMissing(schema, emailContext)
            if (missing.length > 0) {
                await notifySlack(
                    `:warning: *Speaker Portal*: Profil-Update-Anfrage nicht möglich, die Einrichtung in Directus ist unvollständig (${missing.join('; ')}). ${itemUrl}`
                )
                throw new HttpError(
                    500,
                    `Profil-Update-Anfragen sind in Directus noch nicht vollständig eingerichtet: ${missing.join('; ')}.`
                )
            }

            const websiteUrl = (await getSetting('website_url', emailContext))?.trim()
            if (!websiteUrl) {
                await notifySlack(
                    `:warning: *Speaker Portal*: Profil-Update-Anfrage nicht möglich, die Einstellung „website_url“ fehlt in automation_settings. ${itemUrl}`
                )
                throw new HttpError(500, 'Die Einstellung „website_url“ fehlt in automation_settings.')
            }

            const speakersService = new ItemsService('speakers', { schema, accountability: req.accountability })

            let speaker: any = null
            try {
                speaker = await speakersService.readOne(speakerId, { fields: SPEAKER_FIELDS })
            } catch {
                speaker = null
            }
            if (!speaker) {
                throw new HttpError(404, 'Speaker nicht gefunden.')
            }

            const email = typeof speaker.email === 'string' ? speaker.email.trim() : ''
            if (!email) {
                throw new HttpError(400, 'Für diese:n Speaker:in ist keine E-Mail-Adresse hinterlegt.')
            }

            const now = new Date()
            const blocker = findRequestBlocker(speaker, now)
            if (blocker && !force) {
                throw new HttpError(409, blocker.message, {
                    code: blocker.code,
                    requested_at: speaker.portal_update_requested_at ?? null,
                })
            }

            const requestedAt = now.toISOString()
            const token = createPortalToken(now)

            await speakersService.updateOne(
                speakerId,
                {
                    ...token,
                    portal_submission_status: SPEAKER_PORTAL_STATUS.updateRequested,
                    portal_update_requested_at: requestedAt,
                },
                { emitEvents: false }
            )

            const sent = await sendTemplatedEmail(
                {
                    templateKey: PROFILE_UPDATE_TEMPLATE_KEY,
                    to: email,
                    data: {
                        first_name: speaker.first_name,
                        last_name: speaker.last_name,
                        profile_overview: renderProfileOverview(speaker),
                        // Only a published speaker has a public profile to link to.
                        public_profile_url:
                            speaker.status === 'published' && speaker.slug
                                ? buildPublicProfileUrl(websiteUrl, speaker.slug)
                                : undefined,
                        portal_url: buildPortalUrl(websiteUrl, token.portal_token),
                        expires: formatDateGerman(token.portal_token_expires),
                    },
                },
                emailContext
            )

            if (!sent) {
                // The new token stays: the speaker may still be sent the link by hand, and the old
                // one is replaced either way. The request date goes back, so that retrying is not
                // blocked by a cooldown for a mail that never left.
                await speakersService.updateOne(
                    speakerId,
                    { portal_update_requested_at: speaker.portal_update_requested_at ?? null },
                    { emitEvents: false }
                )
                await notifySlack(
                    `:x: *Speaker Portal*: Die Profil-Update-Anfrage an ${speaker.first_name} ${speaker.last_name} konnte nicht versendet werden (siehe Directus-Logs). ${itemUrl}`
                )
                throw new HttpError(
                    502,
                    'Die E-Mail konnte nicht versendet werden. Der neue Portal-Link ist gespeichert, die Anfrage wurde aber nicht zugestellt — bitte später erneut versuchen.',
                    { sent: false }
                )
            }

            logger.info(`${ENDPOINT_NAME}: Sent profile update request for speaker ${speakerId}`)

            res.status(200).send({ sent: true, requested_at: requestedAt })
        } catch (err: any) {
            if (err instanceof HttpError) {
                res.status(err.status).send({ error: err.message, ...err.body })
                return
            }
            logger.error(
                `${ENDPOINT_NAME}: Error requesting a profile update for speaker ${speakerId}: ${err?.message || err}`
            )
            await notifySlack(
                `:x: *Speaker Portal*: Profil-Update-Anfrage fehlgeschlagen (${err?.message || err}). ${itemUrl}`
            )
            res.status(500).send({ error: 'Die Profil-Update-Anfrage ist fehlgeschlagen.' })
        }
    })
})
