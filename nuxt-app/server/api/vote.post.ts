import { useDirectus } from '~/composables/useDirectus'
import { VOTE_COOLDOWN_MINUTES } from '~/config'
import { isbot } from 'isbot'
import { anonymizeAndHashIP, useAuthenticatedDirectus, VoteSchema } from '../utils'

// The only path that writes a vote. The GET /podcast/[slug]/[up|down] links that
// ship in RSS show notes no longer write — they redirect to the podcast page,
// whose client-side script POSTs here. Most crawlers follow the redirect but don't
// run JS; those that do (e.g. meta-externalagent) are filtered by user agent below.
export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event)

    const parseResult = VoteSchema.safeParse(rawBody)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        const key = String(issue?.path?.[0] ?? 'input')
        const message = issue?.message ?? 'Validation error'
        throw createError({ statusCode: 400, message: `${key}: ${message}` })
    }
    const { slug, direction } = parseResult.data

    const userAgent = event.node.req.headers['user-agent']

    // Crawlers and requests without a user agent get the normal success answer,
    // but their vote is not stored.
    if (!userAgent || isbot(userAgent)) {
        return { id: undefined }
    }

    const directus = useDirectus()

    const podcast = await directus.getPodcastBySlug(slug)
    if (!podcast) {
        throw createError({ statusCode: 404, message: 'Podcast not found' })
    }

    const metadata: Record<string, string> = { user_agent: userAgent }

    // Split x-forwarded-for on comma and take the first entry (the client IP)
    const xForwardedFor = event.node.req.headers['x-forwarded-for'] as string | undefined
    const rawIP = xForwardedFor ? xForwardedFor.split(',')[0].trim() : event.node.req.socket.remoteAddress
    const ipHash = rawIP ? anonymizeAndHashIP(rawIP) : undefined
    const referrer = event.node.req.headers['referer']

    if (ipHash) {
        metadata['ip'] = ipHash
    }
    if (referrer) {
        metadata['referer_url'] = referrer
    }

    try {
        // A further vote from the same IP hash on the same episode within the cooldown replaces
        // the earlier one, so a corrected vote counts and a double click counts once.
        if (ipHash) {
            // Reading and changing existing ratings needs the API token; creating one does not.
            const authenticatedDirectus = useAuthenticatedDirectus()
            const since = new Date(Date.now() - VOTE_COOLDOWN_MINUTES * 60 * 1000)
            const recentRating = await authenticatedDirectus.getRecentRatingByIPHash(podcast, ipHash, since)
            if (recentRating) {
                if (recentRating.up_or_down !== direction) {
                    await authenticatedDirectus.updateRatingVote(recentRating, direction)
                }
                return { id: recentRating.id }
            }
        }

        const rating = await directus.createRating(direction, podcast, metadata)
        // Return the id so the page can attach an optional comment to this rating.
        return { id: rating?.id }
    } catch (error) {
        console.error('Failed to store rating for podcast', podcast.slug, error)
        throw createError({
            statusCode: 500,
            message: 'Dein Feedback konnte leider nicht gespeichert werden. Bitte versuche es später erneut.',
        })
    }
})
