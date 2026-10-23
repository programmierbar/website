import { defineEndpoint } from '@directus/extensions-sdk'
import { SPEAKER_PORTAL_STATUS, SPEAKER_PROFILE_UPDATE_VERSION_KEY } from '../../../../../shared-code/index.ts'
import { deliverTemplatedEmail, formatDateGerman, type EmailServiceContext } from '../shared/email-service.ts'
import { isNotFoundError } from '../shared/isNotFoundError.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { getSetting } from '../shared/settings.ts'
import { buildPortalUrl, buildPublicProfileUrl, createPortalToken } from '../shared/speakerPortal.ts'
import { buildFailureSlackMessage, createFailureReportDeduper, parseFailureReport } from './util/failureReport.ts'
import { renderProfileOverview, SPEAKER_LINK_FIELDS } from './util/profileOverview.ts'
import { findRequestBlockers, type GuardedVersion } from './util/requestGuards.ts'

const ENDPOINT_NAME = 'speaker-portal'

/** Key of the `email_templates` row for the profile-update request mail. */
const PROFILE_UPDATE_TEMPLATE_KEY = 'speaker_profile_update_request'

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
 *   Refuses with 409 (`code`/`codes`: `'cooldown' | 'invitation_pending' | 'unreviewed_version'`)
 *   unless `force` is set, when the speaker was asked within the cooldown, their regular invitation
 *   is still open, or their `profile-update` Content Version still holds changes.
 *
 *   Every request starts with a fresh version: an existing `profile-update` version is deleted
 *   before the new token is written. Saving into a version merges into its delta, and promoting does
 *   not delete it, so a reused version would carry fields from an earlier answer into the next one.
 *
 *   The token write runs with `emitEvents: false`: it is not a profile change, so none of the
 *   `speakers.items.update` hooks has anything to do. In particular the invitation in
 *   `speaker-portal-notifications` must not fire for it (it would also skip on its own, since it
 *   only sends while the status is `pending`, and the daily reminders only select `pending`).
 *
 * - POST /speaker-portal/:id/report-update-failure — the website reports that it could not save a
 *   speaker's profile update. Body: `{ stage: string, message: string }`. The website has no Slack
 *   access of its own; this posts the failure to the team channel so it does not stay in the
 *   website's function logs.
 *
 *   Authorised by Directus's own permissions instead of a separate secret: the caller must be
 *   authenticated (the website's static API token belongs to a Directus user) and must be able to
 *   read the speaker with its own accountability — which the website's user already needs to look a
 *   speaker up by portal token. Only speakers with an open update request (`update_requested`) can be
 *   reported. The body is sanitised (one line, no Slack markup, e-mail addresses redacted, capped),
 *   and the same speaker and stage is posted at most once per 10 minutes.
 */
export default defineEndpoint((router, context) => {
    const { logger, services, getSchema, env } = context
    const { ItemsService } = services
    const failureReports = createFailureReportDeduper()

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

    /**
     * The speaker's `profile-update` Content Versions (normally at most one). Read with the
     * requesting admin's accountability.
     */
    async function findProfileUpdateVersions(
        schema: any,
        accountability: any,
        speakerId: string
    ): Promise<Array<GuardedVersion & { id: string }>> {
        const versionsService = new ItemsService('directus_versions', { schema, accountability })
        return await versionsService.readByQuery({
            filter: {
                collection: { _eq: 'speakers' },
                item: { _eq: String(speakerId) },
                key: { _eq: SPEAKER_PROFILE_UPDATE_VERSION_KEY },
            },
            fields: ['id', 'name', 'delta'],
            limit: -1,
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
            } catch (err) {
                // Only "no such speaker" is a 404 (admins may read every speaker); anything else is a
                // real failure for the logger and Slack below.
                if (!isNotFoundError(err)) throw err
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
            const versions = await findProfileUpdateVersions(schema, req.accountability, speakerId)
            const blockers = findRequestBlockers(speaker, now, versions)
            if (blockers.length > 0 && !force) {
                // All of them at once: "send anyway" overrides every one, so the admin sees each.
                throw new HttpError(409, blockers.map((blocker) => blocker.message).join(' '), {
                    code: blockers[0].code,
                    codes: blockers.map((blocker) => blocker.code),
                    requested_at: speaker.portal_update_requested_at ?? null,
                })
            }

            // Every request starts with a fresh version. Saving into a version merges into its
            // delta, so a kept one would carry fields from an earlier answer (e.g. an old image the
            // speaker does not send again) into the next promote. Deleted before the new token is
            // issued: if this fails, nothing about the speaker has changed yet.
            if (versions.length > 0) {
                const versionsService = new ItemsService('directus_versions', {
                    schema,
                    accountability: req.accountability,
                })
                for (const version of versions) {
                    await versionsService.deleteOne(version.id)
                }
                logger.info(
                    `${ENDPOINT_NAME}: Deleted ${versions.length} earlier profile-update version(s) of speaker ${speakerId}`
                )
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

            const result = await deliverTemplatedEmail(
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

            if (result !== 'sent') {
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

    router.post('/:id/report-update-failure', async (req: any, res: any) => {
        // Any authenticated user; whether they may report on this speaker is the read below.
        const accountability = req.accountability
        if (!accountability?.user && accountability?.admin !== true) {
            res.status(401).send({ error: 'Authentication required' })
            return
        }

        const parsed = parseFailureReport(req.body)
        if (!parsed.ok) {
            res.status(400).send({ error: parsed.error })
            return
        }
        const { report } = parsed

        const speakerId = String(req.params.id)
        const itemUrl = `${env.PUBLIC_URL}admin/content/speakers/${encodeURIComponent(speakerId)}`

        try {
            const schema = await getSchema()
            const speakersService = new ItemsService('speakers', { schema, accountability })

            let speaker: any = null
            try {
                speaker = await speakersService.readOne(speakerId, {
                    fields: ['id', 'first_name', 'last_name', 'portal_submission_status', 'portal_token_expires'],
                })
            } catch (err) {
                if (!isNotFoundError(err)) throw err
                speaker = null
            }
            if (!speaker) {
                // Directus answers a missing item and a forbidden one alike; so does this.
                res.status(403).send({ error: 'Speaker not found or not readable' })
                return
            }

            if (speaker.portal_submission_status !== SPEAKER_PORTAL_STATUS.updateRequested) {
                res.status(409).send({ error: 'No open profile update request', code: 'not_update_requested' })
                return
            }

            const key = `${speakerId}:${report.stage}`
            if (!failureReports.claim(key)) {
                logger.info(
                    `${ENDPOINT_NAME}: Skipped duplicate failure report for speaker ${speakerId} (${report.stage})`
                )
                res.status(200).send({ notified: false, reason: 'duplicate' })
                return
            }

            const text = buildFailureSlackMessage({
                speaker,
                report,
                itemUrl,
                now: new Date(),
                formatDate: (date) =>
                    formatDateGerman(date, {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'Europe/Berlin',
                    }),
            })

            try {
                await postSlackMessage(text)
            } catch (err: any) {
                failureReports.release(key)
                logger.error(
                    `${ENDPOINT_NAME}: Failed to post the failure report for speaker ${speakerId} to Slack: ${err?.message || err}`
                )
                res.status(502).send({ error: 'Slack notification failed', notified: false })
                return
            }

            logger.warn(`${ENDPOINT_NAME}: Reported failed profile update for speaker ${speakerId} (${report.stage})`)
            res.status(200).send({ notified: true })
        } catch (err: any) {
            logger.error(
                `${ENDPOINT_NAME}: Error reporting a failed profile update for speaker ${speakerId}: ${err?.message || err}`
            )
            res.status(500).send({ error: 'Failure report could not be processed' })
        }
    })
})
