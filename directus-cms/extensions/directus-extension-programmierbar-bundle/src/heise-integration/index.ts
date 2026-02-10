import { defineHook } from '@directus/extensions-sdk'
import {
    getSetting,
    getSettings,
    getEmailTemplate,
    sendRawEmail,
    formatDateGerman,
    type EmailServiceContext,
} from '../shared/email-service.js'
import { generateHeiseDocument } from './documentGenerator.js'

const HOOK_NAME = 'heise-integration'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const services = hookContext.services
    const getSchema = hookContext.getSchema
    const ItemsService = services.ItemsService

    // Check if MailService is available
    if (!services.MailService) {
        logger.warn(`${HOOK_NAME}: MailService not available. Heise email sending will not work.`)
        logger.warn(`${HOOK_NAME}: Make sure Directus email is configured in .env (EMAIL_TRANSPORT, etc.)`)
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

        const context: EmailServiceContext = {
            logger,
            services,
            getSchema,
            accountability: eventContext.accountability,
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

            // Get website URL from settings
            const websiteUrl = (await getSetting('website_url', context)) || 'https://programmier.bar'

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
                if (
                    podcast.heise_document_status === 'generated' ||
                    podcast.heise_document_status === 'approved' ||
                    podcast.heise_document_status === 'sent'
                ) {
                    logger.info(
                        `${HOOK_NAME}: Heise document already ${podcast.heise_document_status} for podcast ${podcastId}`
                    )
                    continue
                }

                // Check if shownotes are approved
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

                const hasShownotes =
                    (approvedShownotes && approvedShownotes.length > 0) ||
                    (podcast.description && podcast.description.trim().length > 0)

                if (!hasShownotes) {
                    logger.info(
                        `${HOOK_NAME}: No approved shownotes yet for podcast ${podcastId}, skipping document generation`
                    )

                    if (podcast.heise_document_status !== 'pending') {
                        await podcastsService.updateOne(podcastId, {
                            heise_document_status: 'pending',
                        })
                    }
                    continue
                }

                const shownotesContent = approvedShownotes?.[0]?.generated_text || podcast.description

                logger.info(`${HOOK_NAME}: Generating Heise document for podcast ${podcastId}: ${podcast.title}`)

                // Try to get the Heise template from CMS, or use the built-in generator
                let documentHtml: string

                const template = await getEmailTemplate('heise_document', context)
                if (template) {
                    // Use template from CMS with simple variable substitution
                    documentHtml = renderHeiseTemplate(template.body_html, {
                        podcast: { ...podcast, description: shownotesContent },
                        websiteUrl,
                    })
                } else {
                    // Fall back to built-in document generator
                    const document = generateHeiseDocument({
                        podcast: { ...podcast, description: shownotesContent },
                        websiteUrl,
                    })
                    documentHtml = document.html
                }

                // Store the document in podcast_generated_content
                await generatedContentService.createOne({
                    podcast_id: podcastId,
                    content_type: 'heise_document',
                    generated_text: documentHtml,
                    status: 'generated',
                    generated_at: new Date().toISOString(),
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

        const context: EmailServiceContext = {
            logger,
            services,
            getSchema,
            accountability: eventContext.accountability,
        }

        try {
            // Get Heise contact email from CMS settings
            const heiseContactEmail = await getSetting('heise_contact_email', context)

            if (!heiseContactEmail) {
                logger.warn(
                    `${HOOK_NAME}: Cannot send Heise email - heise_contact_email not configured in Automation Settings`
                )
                return
            }

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
                        _and: [{ podcast_id: { _eq: podcastId } }, { content_type: { _eq: 'heise_document' } }],
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

                // Build subject - try to get from template or use default
                const template = await getEmailTemplate('heise_document', context)
                const subject = template
                    ? template.subject.replace(/\{\{title\}\}/g, podcast.title)
                    : `[programmier.bar] Neue Episode: ${podcast.title}`

                logger.info(`${HOOK_NAME}: Sending Heise email for podcast ${podcastId} to ${heiseContactEmail}`)

                const success = await sendRawEmail(
                    {
                        to: heiseContactEmail,
                        subject,
                        html: documentContent,
                        replyTo: 'podcast@programmier.bar',
                    },
                    context
                )

                if (success) {
                    // Update status to 'sent'
                    await podcastsService.updateOne(podcastId, {
                        heise_document_status: 'sent',
                        heise_sent_at: new Date().toISOString(),
                    })

                    logger.info(`${HOOK_NAME}: Heise email sent for podcast ${podcastId}`)
                } else {
                    logger.error(`${HOOK_NAME}: Failed to send Heise email for podcast ${podcastId}`)
                }
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error sending Heise email: ${err?.message || err}`)
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})

/**
 * Render the Heise template with podcast data.
 * This is a simplified template renderer for the Heise document.
 */
function renderHeiseTemplate(
    template: string,
    options: { podcast: any; websiteUrl: string }
): string {
    const { podcast, websiteUrl } = options

    const episodeTypeLabels: Record<string, string> = {
        deep_dive: 'Deep Dive',
        cto_special: 'CTO Special',
        news: 'News',
        other: 'Episode',
    }

    const episodeLabel = podcast.number
        ? `${episodeTypeLabels[podcast.type] || podcast.type} ${podcast.number}`
        : episodeTypeLabels[podcast.type] || podcast.type

    const episodeUrl = `${websiteUrl}/podcast/${podcast.slug}`

    const publicationDate = podcast.planned_publish_date
        ? formatDateGerman(podcast.planned_publish_date)
        : 'Demnächst'

    const hosts =
        podcast.members
            ?.map((m: any) => `${m.member?.first_name} ${m.member?.last_name}`)
            .filter(Boolean)
            .join(', ') || 'programmier.bar Team'

    const guests =
        podcast.speakers
            ?.map((s: any) => {
                const sp = s.speaker
                if (!sp) return ''
                const title = sp.academic_title ? `${sp.academic_title} ` : ''
                return `${title}${sp.first_name} ${sp.last_name}`
            })
            .filter(Boolean)
            .join(', ') || ''

    // Build guest sections HTML
    const guestSections =
        podcast.speakers
            ?.map((s: any) => {
                const sp = s.speaker
                if (!sp) return ''
                const title = sp.academic_title ? `${sp.academic_title} ` : ''
                const name = `${title}${sp.first_name} ${sp.last_name}`
                const links: string[] = []
                if (sp.linkedin_url) links.push(`<a href="${sp.linkedin_url}">LinkedIn</a>`)
                if (sp.website_url) links.push(`<a href="${sp.website_url}">Website</a>`)

                return `
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin: 0 0 5px 0; color: #1a1a1a;">${name}</h4>
                    ${sp.occupation ? `<p style="margin: 0 0 10px 0; color: #666; font-style: italic;">${sp.occupation}</p>` : ''}
                    ${sp.description ? `<p style="margin: 0 0 10px 0;">${sp.description}</p>` : ''}
                    ${links.length > 0 ? `<p style="margin: 0; font-size: 14px;">${links.join(' | ')}</p>` : ''}
                </div>`
            })
            .filter(Boolean)
            .join('') || ''

    // Replace template variables
    let result = template
        .replace(/\{\{episode_label\}\}/g, episodeLabel)
        .replace(/\{\{title\}\}/g, podcast.title || '')
        .replace(/\{\{publication_date\}\}/g, publicationDate)
        .replace(/\{\{hosts\}\}/g, hosts)
        .replace(/\{\{guests\}\}/g, guests)
        .replace(/\{\{episode_url\}\}/g, episodeUrl)
        .replace(/\{\{website_url\}\}/g, websiteUrl)
        .replace(/\{\{\{description\}\}\}/g, podcast.description || '')
        .replace(/\{\{\{guest_sections\}\}\}/g, guestSections)

    // Handle {{#if condition}}...{{/if}} blocks
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, condition, content) => {
        const value = condition === 'guests' ? guests : condition === 'guest_sections' ? guestSections : ''
        if (value && value.trim() !== '') {
            return content
        }
        return ''
    })

    return result
}
