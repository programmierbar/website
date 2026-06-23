import { VoteSchema } from '../utils'
import { useDirectus } from '~/composables/useDirectus'

// The only path that writes a vote. The GET /podcast/[slug]/[up|down] links that
// ship in RSS show notes no longer write — they redirect to the podcast page,
// whose client-side script POSTs here. Crawlers follow the redirect but don't run
// JS, so they never reach this handler.
export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event)

    const parseResult = VoteSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        const key = issue?.path?.[0] ?? 'input'
        const message = issue?.message ?? 'Validation error'
        throw createError({ statusCode: 400, message: `${key}: ${message}` })
    }
    const { slug, direction } = parseResult.data

    const directus = useDirectus()

    const podcast = await directus.getPodcastBySlug(slug)
    if (!podcast) {
        throw createError({ statusCode: 404, message: 'Podcast not found' })
    }

    const metadata: Record<string, string> = {}

    // Split x-forwarded-for on comma and take the first entry (the client IP)
    const xForwardedFor = event.node.req.headers['x-forwarded-for'] as string | undefined
    const rawIP = xForwardedFor
        ? xForwardedFor.split(',')[0].trim()
        : event.node.req.socket.remoteAddress
    const userAgent = event.node.req.headers['user-agent']
    const referrer = event.node.req.headers['referer']

    if (rawIP) {
        metadata['ip'] = rawIP
    }
    if (userAgent) {
        metadata['user_agent'] = userAgent
    }
    if (referrer) {
        metadata['referer_url'] = referrer
    }

    try {
        const rating = await directus.createRating(direction, podcast, metadata)
        // Return the id so the page can attach an optional comment to this rating.
        return { id: rating?.id }
    } catch (error) {
        console.error('Failed to create rating for podcast', podcast.slug, error)
        throw createError({
            statusCode: 500,
            message: 'Dein Feedback konnte leider nicht gespeichert werden. Bitte versuche es später erneut.',
        })
    }
})
