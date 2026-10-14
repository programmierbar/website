// Every error leaves this handler as JSON with a German message the portal can show as-is. Anything
// unexpected is logged here (Vercel function logs) and answered with a generic 500, so internal error
// text never reaches the speaker.
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const token = query.token as string

    if (!token) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Dein Zugangscode fehlt. Bitte nutze den Link aus deiner Einladungs-E-Mail.',
        })
    }

    try {
        const speaker = await useAuthenticatedDirectus().getSpeakerByPortalToken(token)

        if (!speaker) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found',
                message: 'Ungültiger Token. Bitte überprüfe deinen Einladungslink.',
            })
        }

        // Check if token is expired
        if (speaker.portal_token_expires) {
            const expiresAt = new Date(speaker.portal_token_expires)
            if (expiresAt < new Date()) {
                throw createError({
                    statusCode: 410,
                    statusMessage: 'Gone',
                    message: 'Dieser Token ist abgelaufen. Bitte kontaktiere uns für eine neue Einladung.',
                })
            }
        }

        // Check if already submitted
        if (speaker.portal_submission_status === 'submitted' || speaker.portal_submission_status === 'approved') {
            throw createError({
                statusCode: 409,
                statusMessage: 'Conflict',
                message:
                    'Du hast deine Informationen bereits eingereicht. Kontaktiere uns, falls du Änderungen vornehmen möchtest.',
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
        // The 4xx errors above are meant for the speaker; everything else is internal.
        if (err?.statusCode >= 400 && err.statusCode < 500) {
            throw err
        }
        console.error('Speaker portal validation error:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'Bei der Überprüfung deines Zugangs ist leider ein Fehler aufgetreten.',
        })
    }
})
