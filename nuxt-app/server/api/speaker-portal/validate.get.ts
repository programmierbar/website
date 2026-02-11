export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const token = query.token as string

    if (!token) {
        throw createError({
            statusCode: 400,
            message: 'Token is required',
        })
    }

    const config = useRuntimeConfig()
    const directusUrl = config.public.directusCmsUrl || 'http://localhost:8055'
    const adminToken = config.directusAdminToken

    if (!adminToken) {
        console.error('DIRECTUS_ADMIN_TOKEN not configured')
        throw createError({
            statusCode: 500,
            message: 'Serverkonfigurationsfehler',
        })
    }

    try {
        // Query Directus for speaker with this token
        const response = await fetch(
            `${directusUrl}/items/speakers?filter[portal_token][_eq]=${encodeURIComponent(token)}&fields=id,first_name,last_name,academic_title,occupation,description,website_url,linkedin_url,twitter_url,bluesky_url,github_url,instagram_url,youtube_url,portal_token_expires,portal_submission_status,portal_submission_deadline,profile_image,event_image`,
            {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            }
        )

        if (!response.ok) {
            throw new Error('Failed to validate token')
        }

        const data = await response.json()

        if (!data.data || data.data.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Ungültiger Token. Bitte überprüfe deinen Einladungslink.',
            })
        }

        const speaker = data.data[0]

        // Check if token is expired
        if (speaker.portal_token_expires) {
            const expiresAt = new Date(speaker.portal_token_expires)
            if (expiresAt < new Date()) {
                throw createError({
                    statusCode: 410,
                    message: 'Dieser Token ist abgelaufen. Bitte kontaktiere uns für eine neue Einladung.',
                })
            }
        }

        // Check if already submitted
        if (speaker.portal_submission_status === 'submitted' || speaker.portal_submission_status === 'approved') {
            throw createError({
                statusCode: 409,
                message: 'Du hast deine Informationen bereits eingereicht. Kontaktiere uns, falls du Änderungen vornehmen möchtest.',
            })
        }

        return {
            speaker: {
                id: speaker.id,
                first_name: speaker.first_name,
                last_name: speaker.last_name,
                academic_title: speaker.academic_title,
                occupation: speaker.occupation,
                description: speaker.description,
                website_url: speaker.website_url,
                linkedin_url: speaker.linkedin_url,
                twitter_url: speaker.twitter_url,
                bluesky_url: speaker.bluesky_url,
                github_url: speaker.github_url,
                instagram_url: speaker.instagram_url,
                youtube_url: speaker.youtube_url,
                portal_submission_deadline: speaker.portal_submission_deadline,
                profile_image: speaker.profile_image,
                event_image: speaker.event_image,
            },
        }
    } catch (err: any) {
        if (err.statusCode) {
            throw err
        }
        console.error('Speaker portal validation error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist bei der Überprüfung deines Zugangs aufgetreten.',
        })
    }
})
