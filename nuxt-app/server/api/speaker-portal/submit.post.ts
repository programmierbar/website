import { SpeakerSubmissionSchema } from '../../utils/schema'

// Every error leaves this handler as JSON with a German message the portal can show as-is. Anything
// unexpected is logged here (Vercel function logs) and answered with a generic 500, so internal error
// text never reaches the speaker.
export default defineEventHandler(async (event) => {
    let formData: Awaited<ReturnType<typeof readMultipartFormData>>
    try {
        formData = await readMultipartFormData(event)
    } catch (err) {
        console.error('Speaker portal submission: could not read multipart body:', err)
        formData = undefined
    }

    if (!formData) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message:
                'Deine Angaben konnten nicht gelesen werden. Bitte lade die Seite neu und versuche es noch einmal.',
        })
    }

    // Extract form fields
    let token: string | undefined
    let rawData: any
    let profileImage: { filename: string; data: Buffer; type: string } | undefined
    let actionImage: { filename: string; data: Buffer; type: string } | undefined

    for (const field of formData) {
        if (field.name === 'token') {
            token = field.data.toString()
        } else if (field.name === 'data') {
            try {
                rawData = JSON.parse(field.data.toString())
            } catch (err) {
                console.error('Speaker portal submission: data field is not valid JSON:', err)
            }
        } else if (field.name === 'profile_image' && field.filename) {
            profileImage = {
                filename: field.filename,
                data: field.data,
                type: field.type || 'image/jpeg',
            }
        } else if (field.name === 'event_image' && field.filename) {
            actionImage = {
                filename: field.filename,
                data: field.data,
                type: field.type || 'image/jpeg',
            }
        }
    }

    if (!token) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Dein Zugangscode fehlt. Bitte nutze den Link aus deiner Einladungs-E-Mail.',
        })
    }

    if (!rawData) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message:
                'Deine Angaben konnten nicht gelesen werden. Bitte lade die Seite neu und versuche es noch einmal.',
        })
    }

    // Validate form data with Zod
    const parseResult = SpeakerSubmissionSchema.safeParse(rawData)
    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0]
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: firstError?.message || 'Bitte überprüfe deine Angaben und versuche es noch einmal.',
        })
    }
    const data = parseResult.data

    try {
        const directus = useAuthenticatedDirectus()

        // Validate token and get speaker
        const speaker = await directus.getSpeakerByPortalToken(token)

        if (!speaker) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found',
                message: 'Dein Zugangslink ist leider ungültig. Bitte überprüfe den Link aus deiner Einladungs-E-Mail.',
            })
        }

        // Check expiration
        if (speaker.portal_token_expires && new Date(speaker.portal_token_expires) < new Date()) {
            throw createError({
                statusCode: 410,
                statusMessage: 'Gone',
                message: 'Dein Zugangslink ist leider abgelaufen. Bitte kontaktiere uns für eine neue Einladung.',
            })
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

        // Upload images if provided
        let profileImageId: string | undefined
        let actionImageId: string | undefined

        if (profileImage) {
            const imageFormData = new FormData()
            const blob = new Blob([profileImage.data], { type: profileImage.type })
            imageFormData.append('file', blob, profileImage.filename)

            const uploadResult = await directus.uploadFile(imageFormData)
            profileImageId = uploadResult.id
        }

        if (actionImage) {
            const imageFormData = new FormData()
            const blob = new Blob([actionImage.data], { type: actionImage.type })
            imageFormData.append('file', blob, actionImage.filename)

            const uploadResult = await directus.uploadFile(imageFormData)
            actionImageId = uploadResult.id
        }

        // Update speaker record
        const updateData: Record<string, any> = {
            academic_title: data.academic_title || null,
            first_name: data.first_name,
            last_name: data.last_name,
            occupation: data.occupation,
            description: data.description,
            website_url: data.website_url || null,
            linkedin_url: data.linkedin_url || null,
            twitter_url: data.twitter_url || null,
            bluesky_url: data.bluesky_url || null,
            github_url: data.github_url || null,
            instagram_url: data.instagram_url || null,
            youtube_url: data.youtube_url || null,
            mastodon_url: data.mastodon_url || null,
            portal_submission_status: 'submitted',
            portal_token: null, // Invalidate token after submission
        }

        if (profileImageId) {
            updateData.profile_image = profileImageId
        }
        if (actionImageId) {
            updateData.event_image = actionImageId
        }

        await directus.updateSpeaker(speaker.id, updateData)

        return {
            success: true,
            message: 'Speaker information submitted successfully',
        }
    } catch (err: any) {
        // The 4xx errors above are meant for the speaker; everything else is internal.
        if (err?.statusCode >= 400 && err.statusCode < 500) {
            throw err
        }
        console.error('Speaker portal submission error:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'Beim Speichern deiner Informationen ist leider ein Fehler aufgetreten.',
        })
    }
})
