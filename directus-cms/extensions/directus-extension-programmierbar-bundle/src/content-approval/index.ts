import { defineHook } from '@directus/extensions-sdk'

const HOOK_NAME = 'content-approval'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    // Listen for updates to podcast_generated_content
    action('podcast_generated_content.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        if (payload.status === 'approved') {
            await handleApproval(keys, eventContext)
        } else if (payload.status && payload.status !== 'approved') {
            await handleUnapproval(keys, eventContext)
        }
    })

    async function handleApproval(keys: string[], eventContext: any) {
        try {
            const schema = await getSchema()

            const generatedContentService = new ItemsService('podcast_generated_content', {
                schema,
                accountability: eventContext.accountability,
            })

            const podcastsService = new ItemsService('podcasts', {
                schema,
                accountability: eventContext.accountability,
            })

            // Process each approved content item
            for (const contentId of keys) {
                const content = await generatedContentService.readOne(contentId, {
                    fields: ['id', 'podcast_id', 'content_type', 'generated_text'],
                })

                if (!content || !content.podcast_id) {
                    continue
                }

                // If this is shownotes, copy to podcast description
                if (content.content_type === 'shownotes') {
                    if (content.generated_text) {
                        logger.info(
                            `${HOOK_NAME}: Copying approved shownotes to podcast ${content.podcast_id} description`
                        )

                        await podcastsService.updateOne(content.podcast_id, {
                            description: content.generated_text,
                        })
                    }
                }

                // Check if all content for this podcast is approved
                const allContent = await generatedContentService.readByQuery({
                    filter: {
                        podcast_id: { _eq: content.podcast_id },
                    },
                    fields: ['id', 'status'],
                })

                const allApproved =
                    allContent.length > 0 && allContent.every((c: any) => c.status === 'approved')

                if (allApproved) {
                    logger.info(
                        `${HOOK_NAME}: All content approved for podcast ${content.podcast_id}, updating status to 'approved'`
                    )

                    await podcastsService.updateOne(content.podcast_id, {
                        publishing_status: 'approved',
                    })
                }
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing content approval: ${err?.message || err}`)
        }
    }

    async function handleUnapproval(keys: string[], eventContext: any) {
        try {
            const schema = await getSchema()

            const generatedContentService = new ItemsService('podcast_generated_content', {
                schema,
                accountability: eventContext.accountability,
            })

            const podcastsService = new ItemsService('podcasts', {
                schema,
                accountability: eventContext.accountability,
            })

            // Process each unapproved content item
            for (const contentId of keys) {
                const content = await generatedContentService.readOne(contentId, {
                    fields: ['id', 'podcast_id'],
                })

                if (!content || !content.podcast_id) {
                    continue
                }

                // If the podcast was marked as approved, revert to content_review
                const podcast = await podcastsService.readOne(content.podcast_id, {
                    fields: ['publishing_status'],
                })

                if (podcast.publishing_status === 'approved') {
                    logger.info(
                        `${HOOK_NAME}: Content unapproved for podcast ${content.podcast_id}, reverting status to 'content_review'`
                    )

                    await podcastsService.updateOne(content.podcast_id, {
                        publishing_status: 'content_review',
                    })
                }
            }
        } catch (err: any) {
            logger.error(`${HOOK_NAME}: Error processing content unapproval: ${err?.message || err}`)
        }
    }

    logger.info(`${HOOK_NAME} hook registered`)
})
