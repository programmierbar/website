import { defineHook } from '@directus/extensions-sdk'
import { generateHeiseDocument, buildHeiseEmail } from './documentGenerator.js'
import { sendEmail, type EmailConfig } from './sendEmail.js'

const HOOK_NAME = 'heise-integration'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const FilesService = hookContext.services.FilesService
    const getSchema = hookContext.getSchema

    // Check for required configuration
    const heiseContactEmail = env.HEISE_CONTACT_EMAIL
    const emailHost = env.EMAIL_SMTP_HOST
    const emailUser = env.EMAIL_SMTP_USER
    const emailPassword = env.EMAIL_SMTP_PASSWORD
    const websiteUrl = env.WEBSITE_URL || 'https://programmier.bar'

    if (!emailHost || !emailUser || !emailPassword) {
        logger.warn(`${HOOK_NAME}: Email SMTP not configured. Heise integration will not be active.`)
        return
    }

    if (!heiseContactEmail) {
        logger.warn(`${HOOK_NAME}: HEISE_CONTACT_EMAIL not configured. Email sending will be disabled.`)
    }

    const emailConfig: EmailConfig = {
        host: emailHost,
        port: parseInt(env.EMAIL_SMTP_PORT || '465'),
        secure: env.EMAIL_SMTP_SECURE !== 'false',
        user: emailUser,
        password: emailPassword,
        from: env.EMAIL_FROM || 'programmier.bar <podcast@programmier.bar>',
    }

    /**
     * Trigger document generation when heise_eligible is set to true
     * OR when publishing_status changes to 'approved' for an eligible podcast.
     */
    action('podcasts.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Check if this update makes the podcast eligible for Heise document generation
        const isSettingEligible = payload.heise_eligible === true
        const isApproving = payload.publishing_status === 'approved'

        if (!isSettingEligible && !isApproving) {
            return
        }

        try {
            const schema = await getSchema()

            const podcastsService = new ItemsService('podcasts', {
                schema,
                accountability: eventContext.accountability,
            })

            const generatedContentService = new ItemsService('podcast_generated_content', {
                schema,
                accountability: eventContext.accountability,
            })

            for (const podcastId of keys) {
                // Fetch full podcast data
                const podcast = await podcastsService.readOne(podcastId, {
                    fields: [
                        'id',
                        'title',
                        'slug',
                        'type',
                        'number',
                        'description',
                        'planned_publish_date',
                        'publishing_status',
                        'heise_eligible',
                        'heise_document_status',
                        'speakers.speaker.first_name',
                        'speakers.speaker.last_name',
                        'speakers.speaker.academic_title',
                        'speakers.speaker.occupation',
                        'speakers.speaker.description',
                        'speakers.speaker.linkedin_url',
                        'speakers.speaker.website_url',
                        'members.member.first_name',
                        'members.member.last_name',
                    ],
                })

                if (!podcast) {
                    logger.warn(`${HOOK_NAME}: Podcast ${podcastId} not found`)
                    continue
                }

                // Check if podcast is eligible
                const isEligible = isSettingEligible ? true : podcast.heise_eligible
                if (!isEligible) {
                    continue
                }

                // Check if document already generated or sent
                if (podcast.heise_document_status === 'generated' ||
                    podcast.heise_document_status === 'approved' ||
                    podcast.heise_document_status === 'sent') {
                    logger.info(`${HOOK_NAME}: Heise document already ${podcast.heise_document_status} for podcast ${podcastId}`)
                    continue
                }

                // Check if shownotes are approved (required for document generation)
                const approvedShownotes = await generatedContentService.readByQuery({
                    filter: {
                        _and: [
                            { podcast_id: { _eq: podcastId } },
                            { content_type: { _eq: 'shownotes' } },
                            { status: { _eq: 'approved' } },
                        ],
                    },
                    fields: ['id', 'generated_text'],
                    limit: 1,
                })

                // Also check if description is available (shownotes might have been copied there)
                const hasShownotes =
                    (approvedShownotes && approvedShownotes.length > 0) ||
                    (podcast.description && podcast.description.trim().length > 0)

                if (!hasShownotes) {
                    logger.info(`${HOOK_NAME}: No approved shownotes yet for podcast ${podcastId}, skipping document generation`)

                    // Set status to pending so it's clear we're waiting
                    if (podcast.heise_document_status !== 'pending') {
                        await podcastsService.updateOne(podcastId, {
                            heise_document_status: 'pending',
                        })
                    }
                    continue
                }

                // Use approved shownotes content or existing description
                const shownotesContent =
                    approvedShownotes?.[0]?.generated_text || podcast.description

                logger.info(`${HOOK_NAME}: Generating Heise document for podcast ${podcastId}: ${podcast.title}`)

                // Generate the document
                const document = generateHeiseDocument({
                    podcast: {
                        ...podcast,
                        description: shownotesContent,
                    },
                    websiteUrl,
                })

                // Store the document in podcast_generated_content
                await generatedContentService.createOne({
                    podcast_id: podcastId,
                    content_type: 'heise_document',
                    generated_text: document.html,
                    status: 'generated',
                    generated_at: new Date().toISOString(),
                    llm_model: 'template',
                    prompt_version: '1.0',
                })

                // Update podcast status
                await podcastsService.updateOne(podcastId, {
                    heise_document_status: 'generated',
                })

                logger.info(`${HOOK_NAME}: Heise document generated for podcast ${podcastId}`)
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error generating Heise document: ${err?.message || err}`)
        }
    })

    /**
     * Trigger email sending when heise_document_status is changed to 'approved'.
     */
    action('podcasts.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if status is being set to 'approved'
        if (payload.heise_document_status !== 'approved') {
            return
        }

        if (!heiseContactEmail) {
            logger.warn(`${HOOK_NAME}: Cannot send Heise email - HEISE_CONTACT_EMAIL not configured`)
            return
        }

        try {
            const schema = await getSchema()

            const podcastsService = new ItemsService('podcasts', {
                schema,
                accountability: eventContext.accountability,
            })

            const generatedContentService = new ItemsService('podcast_generated_content', {
                schema,
                accountability: eventContext.accountability,
            })

            for (const podcastId of keys) {
                // Fetch podcast data
                const podcast = await podcastsService.readOne(podcastId, {
                    fields: ['id', 'title', 'slug', 'heise_document_status'],
                })

                if (!podcast) {
                    continue
                }

                // Fetch the generated Heise document
                const heiseDocuments = await generatedContentService.readByQuery({
                    filter: {
                        _and: [
                            { podcast_id: { _eq: podcastId } },
                            { content_type: { _eq: 'heise_document' } },
                        ],
                    },
                    fields: ['id', 'generated_text'],
                    limit: 1,
                    sort: ['-generated_at'],
                })

                if (!heiseDocuments || heiseDocuments.length === 0) {
                    logger.error(`${HOOK_NAME}: No Heise document found for podcast ${podcastId}`)
                    continue
                }

                const documentContent = heiseDocuments[0].generated_text

                // Build and send email
                const email = buildHeiseEmail({
                    title: podcast.title,
                    documentHtml: documentContent,
                })

                logger.info(`${HOOK_NAME}: Sending Heise email for podcast ${podcastId} to ${heiseContactEmail}`)

                await sendEmail(
                    {
                        to: heiseContactEmail,
                        subject: email.subject,
                        html: email.html,
                        replyTo: 'podcast@programmier.bar',
                    },
                    emailConfig,
                    logger
                )

                // Update status to 'sent'
                await podcastsService.updateOne(podcastId, {
                    heise_document_status: 'sent',
                    heise_sent_at: new Date().toISOString(),
                })

                logger.info(`${HOOK_NAME}: Heise email sent for podcast ${podcastId}`)
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error sending Heise email: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
