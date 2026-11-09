import { createHash, timingSafeEqual } from 'node:crypto'

// Content the heise.de newsroom needs to feature an episode, often before it is public. A wrong or
// missing token and a podcast that is not released to heise all answer 404, the same as a podcast
// that does not exist, so the response reveals nothing about which episodes are in the works.
export default defineEventHandler(async (event) => {
    const accessToken = useRuntimeConfig().heiseAccessToken
    if (!accessToken) {
        console.error('[heise] NUXT_HEISE_ACCESS_TOKEN is not configured')
        throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
    }

    const slug = getRouterParam(event, 'slug')
    const token = getQuery(event).token

    if (!slug || typeof token !== 'string' || !isSameSecret(token, accessToken)) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    let podcast
    try {
        podcast = await useAuthenticatedDirectus().getHeisePodcastBySlug(slug)
    } catch (err) {
        console.error('[heise] Failed to load podcast', slug, err)
        throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
    }

    if (!podcast) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    return {
        slug: podcast.slug,
        youtubeUrl: podcast.youtube_url,
        title: podcast.heise_titel,
        anriss: podcast.heise_anriss,
        text: podcast.heise_text,
        cover: podcast.heise_cover,
    }
})

// Hashing first gives both sides the same length, which `timingSafeEqual` requires, so the
// comparison takes the same time however much of the token is right.
function isSameSecret(actual: string, expected: string) {
    const digest = (value: string) => createHash('sha256').update(value).digest()
    return timingSafeEqual(digest(actual), digest(expected))
}
