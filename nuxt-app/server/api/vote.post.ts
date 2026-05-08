import type { H3Event } from 'h3'
import { useDirectus } from '~/composables/useDirectus'
import { VoteSchema } from '~/server/utils/schema'
import type { DirectusPodcastItem } from '~/types'

export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event)
    const parsed = VoteSchema.safeParse(rawBody)
    if (!parsed.success) {
        throw createError({ statusCode: 400, message: 'Invalid request' })
    }

    const { episode_id, direction } = parsed.data
    const directus = useDirectus()
    const podcast = await directus.getPodcastById(episode_id)
    if (!podcast) {
        throw createError({ statusCode: 404, message: 'Episode not found' })
    }

    const metadata = collectMetadata(event)

    try {
        const rating = await directus.createRating(direction, podcast as DirectusPodcastItem, metadata)
        console.log('[vote-post]', podcast.slug, direction)
        return { success: true, message: 'Vielen Dank für dein Feedback!', payload: { id: rating?.id } }
    } catch (err) {
        console.error('[vote-post] Failed to create rating', podcast.slug, err)
        throw createError({ statusCode: 500, message: 'Fehler beim Speichern des Feedbacks' })
    }
})

function collectMetadata(event: H3Event): Record<string, string> {
    const metadata: Record<string, string> = {}
    const xForwardedFor = event.node.req.headers['x-forwarded-for'] as string | undefined
    const rawIP = xForwardedFor
        ? xForwardedFor.split(',')[0].trim()
        : event.node.req.socket.remoteAddress
    const userAgent = event.node.req.headers['user-agent']
    const referrer = event.node.req.headers['referer']
    if (rawIP) metadata['ip'] = rawIP
    if (userAgent) metadata['user_agent'] = userAgent
    if (referrer) metadata['referer_url'] = referrer
    return metadata
}
