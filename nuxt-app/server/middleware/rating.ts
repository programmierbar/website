import { useDirectus } from '~/composables/useDirectus'

export default eventHandler(async function (event) {
    const requestPath = event.path
    if (!requestPath.startsWith('/podcast/')) {
        return
    }

    // Path pattern "/podcast/[slug]/[up|down]"
    const regex = /^\/podcast\/([^/]+)\/(up|down)$/
    const match = requestPath.match(regex)
    if (!match) {
        return
    }

    const slug = match[1]
    const voteString = match[2]

    // Type narrowing: the regex already validated this is "up" or "down"
    // We use a type guard to make TypeScript aware of this
    if (voteString !== 'up' && voteString !== 'down') {
        // This should never happen due to regex validation, but satisfies TypeScript
        throw createError({ statusCode: 400, message: 'Invalid vote value' })
    }
    const vote = voteString

    const directus = useDirectus()

    const podcast = await directus.getPodcastBySlug(slug)

    if (!podcast) {
        throw createError({ statusCode: 404, message: 'Podcast not found' })
    }

    try {
        await directus.createRating(vote, podcast)

        // Set flash message cookie on success
        setCookie(
            event,
            'flash-message',
            JSON.stringify({
                text: 'Vielen Dank für dein Feedback!',
                type: 'rating',
                payload: {},
            }),
            {
                maxAge: 60, // 60 seconds
                path: '/',
            }
        )
    } catch (error) {
        // Log the error and set an error flash message
        console.error('Failed to create rating for podcast', podcast.slug, error)
        setCookie(
            event,
            'flash-message',
            JSON.stringify({
                text: 'Dein Feedback konnte leider nicht gespeichert werden. Bitte versuche es später erneut.',
                type: 'rating-error',
                payload: {},
            }),
            {
                maxAge: 60, // 60 seconds
                path: '/',
            }
        )
    }

    // Set the response status and location header for redirection
    // And end the response to complete the redirection
    event.node.res.writeHead(302, {
        Location: '/podcast/' + podcast.slug,
    })

    event.node.res.end()
})
