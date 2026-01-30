import { defineHook } from '@directus/extensions-sdk'
import { publishToBluesky } from './bluesky.js'
import { publishToMastodon } from './mastodon.js'

const HOOK_NAME = 'social-media-publish'

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const env = hookContext.env
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    // Check if any social media credentials are configured
    const hasBluesky = env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD
    const hasMastodon = env.MASTODON_INSTANCE_URL && env.MASTODON_ACCESS_TOKEN

    if (!hasBluesky && !hasMastodon) {
        logger.warn(`${HOOK_NAME}: No social media credentials configured. Publishing will not be active.`)
        return
    }

    logger.info(`${HOOK_NAME}: Initialized with platforms: ${[hasBluesky && 'Bluesky', hasMastodon && 'Mastodon'].filter(Boolean).join(', ')}`)

    // Trigger when a social_media_posts item is updated to 'scheduled' and scheduled_for is now or in the past
    // OR when manually triggered by setting status to 'publishing'
    action('social_media_posts.items.update', async function (metadata, eventContext) {
        const { payload, keys } = metadata

        // Only proceed if status is being set to 'publishing'
        if (payload.status !== 'publishing') {
            return
        }

        const schema = await getSchema()
        const postsService = new ItemsService('social_media_posts', {
            schema,
            accountability: eventContext.accountability,
        })

        for (const postId of keys) {
            try {
                const post = await postsService.readOne(postId, {
                    fields: ['id', 'platform', 'post_text', 'tags', 'podcast_id'],
                })

                if (!post) {
                    logger.warn(`${HOOK_NAME}: Post ${postId} not found`)
                    continue
                }

                logger.info(`${HOOK_NAME}: Publishing post ${postId} to ${post.platform}`)

                let result: { postId: string; postUrl: string } | null = null

                switch (post.platform) {
                    case 'bluesky':
                        if (!hasBluesky) {
                            throw new Error('Bluesky credentials not configured')
                        }
                        result = await publishToBluesky(post.post_text, {
                            handle: env.BLUESKY_HANDLE,
                            appPassword: env.BLUESKY_APP_PASSWORD,
                            logger,
                        })
                        break

                    case 'mastodon':
                        if (!hasMastodon) {
                            throw new Error('Mastodon credentials not configured')
                        }
                        result = await publishToMastodon(post.post_text, {
                            instanceUrl: env.MASTODON_INSTANCE_URL,
                            accessToken: env.MASTODON_ACCESS_TOKEN,
                            logger,
                        })
                        break

                    case 'linkedin':
                    case 'instagram':
                        // Not implemented yet
                        throw new Error(`${post.platform} publishing not yet implemented`)

                    default:
                        throw new Error(`Unknown platform: ${post.platform}`)
                }

                if (result) {
                    await postsService.updateOne(postId, {
                        status: 'published',
                        platform_post_id: result.postId,
                        platform_post_url: result.postUrl,
                        published_at: new Date().toISOString(),
                        error_message: null,
                    })

                    logger.info(`${HOOK_NAME}: Successfully published post ${postId} to ${post.platform}: ${result.postUrl}`)
                }
            } catch (err: any) {
                logger.error(`${HOOK_NAME}: Failed to publish post ${postId}: ${err?.message || err}`)

                await postsService.updateOne(postId, {
                    status: 'failed',
                    error_message: err?.message || String(err),
                })
            }
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
