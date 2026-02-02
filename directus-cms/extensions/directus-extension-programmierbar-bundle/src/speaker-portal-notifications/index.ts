import { defineHook } from '@directus/extensions-sdk'
import {
    sendTemplatedEmail,
    getSetting,
    getSettings,
    formatDateGerman,
    type EmailServiceContext,
} from '../shared/email-service.js'

const HOOK_NAME = 'speaker-portal-notifications'

// Check deadline reminders at 9:00 AM every day
const REMINDER_SCHEDULE = '0 9 * * *'

export default defineHook(({ action, schedule }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema
    const ItemsService = services.ItemsService

    // Check if MailService is available
    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. Email notifications will not work.`)
        logger.warn(`${HOOK_NAME}: Make sure Directus email is configured in .env (EMAIL_TRANSPORT, etc.)`)
    }

    /**
     * Build the portal URL for a speaker token.
     */
    async function buildPortalUrl(token: string, context: EmailServiceContext): Promise<string> {
        const websiteUrl = (await getSetting('website_url', context)) || 'https://programmier.bar'
        return `${websiteUrl}/speaker-portal?token=${encodeURIComponent(token)}`
    }

    /**
     * Send invitation email when a speaker's portal token is generated.
     */
    action('speakers.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if portal_token was just set
        if (!payload.portal_token) {
            return
        }

        const context: EmailServiceContext = {
            logger,
            services,
            getSchema,
            accountability: eventContext.accountability,
        }

        try {
            const schema = await getSchema()

            const speakersService = new ItemsService('speakers', {
                schema,
                accountability: eventContext.accountability,
            })

            for (const speakerId of keys) {
                const speaker = await speakersService.readOne(speakerId, {
                    fields: [
                        'id',
                        'first_name',
                        'last_name',
                        'email',
                        'portal_token',
                        'portal_submission_deadline',
                        'portal_submission_status',
                    ],
                })

                // Only send if speaker has email and status is pending
                if (!speaker?.email || speaker.portal_submission_status !== 'pending') {
                    continue
                }

                // Verify this is the token being set
                if (speaker.portal_token !== payload.portal_token) {
                    continue
                }

                // Find related podcast for context
                let podcastTitle: string | undefined
                let recordingDate: string | undefined

                try {
                    const podcastSpeakersService = new ItemsService('podcasts_speakers', {
                        schema,
                        accountability: eventContext.accountability,
                    })

                    const podcastsService = new ItemsService('podcasts', {
                        schema,
                        accountability: eventContext.accountability,
                    })

                    const relations = await podcastSpeakersService.readByQuery({
                        filter: { speaker: { _eq: speakerId } },
                        fields: ['podcast'],
                        limit: 1,
                        sort: ['-id'],
                    })

                    if (relations && relations.length > 0 && relations[0].podcast) {
                        const podcast = await podcastsService.readOne(relations[0].podcast, {
                            fields: ['title', 'recording_date'],
                        })
                        podcastTitle = podcast?.title
                        recordingDate = podcast?.recording_date
                    }
                } catch {
                    // Podcast lookup is optional
                }

                const portalUrl = await buildPortalUrl(speaker.portal_token, context)
                const deadline = speaker.portal_submission_deadline
                    ? formatDateGerman(speaker.portal_submission_deadline)
                    : 'in den nächsten zwei Wochen'

                logger.info(`${HOOK_NAME}: Sending invitation email to ${speaker.email}`)

                await sendTemplatedEmail(
                    {
                        templateKey: 'speaker_invitation',
                        to: speaker.email,
                        data: {
                            first_name: speaker.first_name,
                            last_name: speaker.last_name,
                            portal_url: portalUrl,
                            deadline,
                            podcast_title: podcastTitle,
                            recording_date: recordingDate ? formatDateGerman(recordingDate) : undefined,
                        },
                    },
                    context
                )

                logger.info(`${HOOK_NAME}: Invitation sent to ${speaker.first_name} ${speaker.last_name}`)
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error sending invitation email: ${err?.message || err}`)
        }
    })

    /**
     * Send confirmation when a speaker submits their information.
     */
    action('speakers.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if status is being set to 'submitted'
        if (payload.portal_submission_status !== 'submitted') {
            return
        }

        const context: EmailServiceContext = {
            logger,
            services,
            getSchema,
            accountability: eventContext.accountability,
        }

        try {
            const schema = await getSchema()

            const speakersService = new ItemsService('speakers', {
                schema,
                accountability: eventContext.accountability,
            })

            for (const speakerId of keys) {
                const speaker = await speakersService.readOne(speakerId, {
                    fields: ['id', 'first_name', 'last_name', 'email'],
                })

                if (!speaker?.email) {
                    continue
                }

                // Find related podcast for context
                let podcastTitle: string | undefined
                try {
                    const podcastSpeakersService = new ItemsService('podcasts_speakers', {
                        schema,
                        accountability: eventContext.accountability,
                    })
                    const podcastsService = new ItemsService('podcasts', {
                        schema,
                        accountability: eventContext.accountability,
                    })

                    const relations = await podcastSpeakersService.readByQuery({
                        filter: { speaker: { _eq: speakerId } },
                        fields: ['podcast'],
                        limit: 1,
                        sort: ['-id'],
                    })

                    if (relations && relations.length > 0 && relations[0].podcast) {
                        const podcast = await podcastsService.readOne(relations[0].podcast, {
                            fields: ['title'],
                        })
                        podcastTitle = podcast?.title
                    }
                } catch {
                    // Optional
                }

                const emailData = {
                    first_name: speaker.first_name,
                    last_name: speaker.last_name,
                    podcast_title: podcastTitle,
                }

                // Send confirmation to speaker
                logger.info(`${HOOK_NAME}: Sending submission confirmation to ${speaker.email}`)

                await sendTemplatedEmail(
                    {
                        templateKey: 'speaker_submission_confirmation',
                        to: speaker.email,
                        data: emailData,
                    },
                    context
                )

                // Send notification to admin
                const adminEmail = await getSetting('admin_notification_email', context)
                if (adminEmail) {
                    await sendTemplatedEmail(
                        {
                            templateKey: 'speaker_admin_notification',
                            to: adminEmail,
                            data: emailData,
                        },
                        context
                    )
                }

                logger.info(`${HOOK_NAME}: Submission confirmation sent for ${speaker.first_name} ${speaker.last_name}`)
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error sending submission confirmation: ${err?.message || err}`)
        }
    })

    /**
     * Scheduled task to send deadline reminders.
     */
    schedule(REMINDER_SCHEDULE, async () => {
        logger.info(`${HOOK_NAME}: Running deadline reminder check`)

        const context: EmailServiceContext = {
            logger,
            services,
            getSchema,
            accountability: { admin: true },
        }

        try {
            const schema = await getSchema()

            const speakersService = new ItemsService('speakers', {
                schema,
                accountability: { admin: true },
            })

            const settings = await getSettings(['website_url'], context)
            const websiteUrl = settings.website_url || 'https://programmier.bar'

            const now = new Date()
            const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

            // Find speakers with pending submissions and approaching deadlines
            const pendingSpeakers = await speakersService.readByQuery({
                filter: {
                    _and: [
                        { portal_submission_status: { _eq: 'pending' } },
                        { portal_token: { _nnull: true } },
                        { email: { _nnull: true } },
                        { portal_submission_deadline: { _nnull: true } },
                    ],
                },
                fields: [
                    'id',
                    'first_name',
                    'last_name',
                    'email',
                    'portal_token',
                    'portal_submission_deadline',
                ],
            })

            logger.info(`${HOOK_NAME}: Found ${pendingSpeakers.length} pending speakers to check`)

            for (const speaker of pendingSpeakers) {
                const deadline = new Date(speaker.portal_submission_deadline)

                // Skip if deadline already passed
                if (deadline < now) {
                    logger.info(`${HOOK_NAME}: Deadline passed for ${speaker.email}, skipping`)
                    continue
                }

                const portalUrl = `${websiteUrl}/speaker-portal?token=${encodeURIComponent(speaker.portal_token)}`
                const deadlineFormatted = formatDateGerman(deadline)

                const emailData = {
                    first_name: speaker.first_name,
                    last_name: speaker.last_name,
                    portal_url: portalUrl,
                    deadline: deadlineFormatted,
                }

                // Urgent reminder (1 day before)
                if (deadline <= oneDayFromNow) {
                    logger.info(`${HOOK_NAME}: Sending urgent reminder to ${speaker.email}`)

                    await sendTemplatedEmail(
                        {
                            templateKey: 'speaker_urgent_reminder',
                            to: speaker.email,
                            data: emailData,
                        },
                        context
                    )
                }
                // Regular reminder (3 days before)
                else if (deadline <= threeDaysFromNow) {
                    logger.info(`${HOOK_NAME}: Sending reminder to ${speaker.email}`)

                    await sendTemplatedEmail(
                        {
                            templateKey: 'speaker_reminder',
                            to: speaker.email,
                            data: emailData,
                        },
                        context
                    )
                }
            }

            logger.info(`${HOOK_NAME}: Deadline reminder check complete`)
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error in deadline reminder check: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered with reminder schedule: ${REMINDER_SCHEDULE}`)
})
