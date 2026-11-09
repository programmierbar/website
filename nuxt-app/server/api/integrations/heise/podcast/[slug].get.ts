// Content the heise.de newsroom needs to feature an episode. A podcast that is not released to heise
// answers 404, the same as one that does not exist.
export default defineEventHandler(async (event) => {
    const slug = getRouterParam(event, 'slug')

    if (!slug) {
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
