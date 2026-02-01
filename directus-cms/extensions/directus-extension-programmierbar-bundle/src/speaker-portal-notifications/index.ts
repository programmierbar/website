import { defineHook } from '@directus/extensions-sdk'
import { sendEmail } from './sendEmail.js'
import {
    buildInvitationEmail,
    buildReminderEmail,
    buildUrgentReminderEmail,
    buildSubmissionConfirmationEmail,
    buildAdminNotificationEmail,
    type SpeakerEmailData,
} from './emailTemplates.js'

const HOOK_NAME = 'speaker-portal-notifications'

// Check deadline reminders at 9:00 AM every day
const REMINDER_SCHEDULE = '0 9 * * *'

export default defineHook(({ action, schedule }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    // Check for required email configuration
    const emailHost = env.EMAIL_SMTP_HOST
    const emailUser = env.EMAIL_SMTP_USER
    const emailPassword = env.EMAIL_SMTP_PASSWORD
    const websiteUrl = env.WEBSITE_URL || 'https://programmier.bar'
    const adminEmail = env.ADMIN_NOTIFICATION_EMAIL || 'podcast@programmier.bar'

    if (!emailHost || !emailUser || !emailPassword) {
        logger.warn(`${HOOK_NAME}: Email SMTP not configured. Speaker notifications will not be active.`)
        return
    }

    const emailConfig = {
        host: emailHost,
        port: parseInt(env.EMAIL_SMTP_PORT || '465'),
        secure: env.EMAIL_SMTP_SECURE !== 'false',
        user: emailUser,
        password: emailPassword,
        from: env.EMAIL_FROM || 'programmier.bar <noreply@programmier.bar>',
    }

    /**
     * Build the portal URL for a speaker token.
     */
    function buildPortalUrl(token: string): string {
        return `${websiteUrl}/speaker-portal?token=${encodeURIComponent(token)}`
    }

    /**
     * Send invitation email when a speaker's portal token is generated.
     * Triggers when portal_token is set on a speaker record.
     */
    action('speakers.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if portal_token was just set (token generation)
        if (!payload.portal_token) {
            return
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

                // Only send if speaker has email and status is pending (newly generated token)
                if (!speaker?.email || speaker.portal_submission_status !== 'pending') {
                    continue
                }

                // Check if token matches (to verify this is the token being set)
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

                    // Find podcast relations for this speaker
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
                    // Podcast lookup is optional, continue without it
                }

                const emailData: SpeakerEmailData = {
                    firstName: speaker.first_name,
                    lastName: speaker.last_name,
                    email: speaker.email,
                    portalUrl: buildPortalUrl(speaker.portal_token),
                    deadline: speaker.portal_submission_deadline,
                    podcastTitle,
                    recordingDate,
                }

                const email = buildInvitationEmail(emailData)

                logger.info(`${HOOK_NAME}: Sending invitation email to ${speaker.email}`)

                await sendEmail(
                    {
                        to: speaker.email,
                        subject: email.subject,
                        html: email.html,
                    },
                    emailConfig,
                    logger
                )

                logger.info(`${HOOK_NAME}: Invitation email sent to ${speaker.first_name} ${speaker.last_name}`)
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error sending invitation email: ${err?.message || err}`)
        }
    })

    /**
     * Send confirmation email when a speaker submits their information.
     * Triggers when portal_submission_status changes to 'submitted'.
     */
    action('speakers.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if status is being set to 'submitted'
        if (payload.portal_submission_status !== 'submitted') {
            return
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
                    // Optional, continue
                }

                const emailData: SpeakerEmailData = {
                    firstName: speaker.first_name,
                    lastName: speaker.last_name,
                    email: speaker.email,
                    portalUrl: '',
                    podcastTitle,
                }

                // Send confirmation to speaker
                const confirmationEmail = buildSubmissionConfirmationEmail(emailData)

                logger.info(`${HOOK_NAME}: Sending submission confirmation to ${speaker.email}`)

                await sendEmail(
                    {
                        to: speaker.email,
                        subject: confirmationEmail.subject,
                        html: confirmationEmail.html,
                    },
                    emailConfig,
                    logger
                )

                // Send notification to admin
                const adminNotificationEmail = buildAdminNotificationEmail(emailData)

                await sendEmail(
                    {
                        to: adminEmail,
                        subject: adminNotificationEmail.subject,
                        html: adminNotificationEmail.html,
                    },
                    emailConfig,
                    logger
                )

                logger.info(`${HOOK_NAME}: Submission confirmation emails sent for ${speaker.first_name} ${speaker.last_name}`)
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error sending submission confirmation: ${err?.message || err}`)
        }
    })

    /**
     * Scheduled task to send deadline reminders.
     * Runs daily at 9:00 AM.
     */
    schedule(REMINDER_SCHEDULE, async () => {
        logger.info(`${HOOK_NAME}: Running deadline reminder check`)

        try {
            const schema = await getSchema()

            const speakersService = new ItemsService('speakers', {
                schema,
                accountability: { admin: true },
            })

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
                    logger.info(`${HOOK_NAME}: Deadline passed for ${speaker.email}, skipping reminder`)
                    continue
                }

                const emailData: SpeakerEmailData = {
                    firstName: speaker.first_name,
                    lastName: speaker.last_name,
                    email: speaker.email,
                    portalUrl: buildPortalUrl(speaker.portal_token),
                    deadline: speaker.portal_submission_deadline,
                }

                // Check if deadline is within 1 day (urgent reminder)
                if (deadline <= oneDayFromNow) {
                    logger.info(`${HOOK_NAME}: Sending urgent reminder to ${speaker.email} (deadline in ~1 day)`)

                    const urgentEmail = buildUrgentReminderEmail(emailData)

                    await sendEmail(
                        {
                            to: speaker.email,
                            subject: urgentEmail.subject,
                            html: urgentEmail.html,
                        },
                        emailConfig,
                        logger
                    )

                    logger.info(`${HOOK_NAME}: Urgent reminder sent to ${speaker.email}`)
                }
                // Check if deadline is within 3 days (regular reminder)
                else if (deadline <= threeDaysFromNow) {
                    logger.info(`${HOOK_NAME}: Sending reminder to ${speaker.email} (deadline in ~3 days)`)

                    const reminderEmail = buildReminderEmail(emailData)

                    await sendEmail(
                        {
                            to: speaker.email,
                            subject: reminderEmail.subject,
                            html: reminderEmail.html,
                        },
                        emailConfig,
                        logger
                    )

                    logger.info(`${HOOK_NAME}: Reminder sent to ${speaker.email}`)
                }
            }

            logger.info(`${HOOK_NAME}: Deadline reminder check complete`)
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error in deadline reminder check: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered with reminder schedule: ${REMINDER_SCHEDULE}`)
})
