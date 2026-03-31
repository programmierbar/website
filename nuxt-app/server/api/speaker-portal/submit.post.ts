import { SpeakerSubmissionSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
    const formData = await readMultipartFormData(event)

    if (!formData) {
        throw createError({
            statusCode: 400,
            message: 'Invalid form data',
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
            rawData = JSON.parse(field.data.toString())
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
            message: 'Token is required',
        })
    }

    if (!rawData) {
        throw createError({
            statusCode: 400,
            message: 'Form data is required',
        })
    }

    // Validate form data with Zod
    const parseResult = SpeakerSubmissionSchema.safeParse(rawData)
    if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]
        throw createError({
            statusCode: 400,
            message: firstError?.message || 'Ungültige Formulardaten',
        })
    }
    const data = parseResult.data

    const directus = useAuthenticatedDirectus()

    try {
        // Validate token and get speaker
        const speaker = await directus.getSpeakerByPortalToken(token)

        if (!speaker) {
            throw createError({
                statusCode: 404,
                message: 'Ungültiger Token',
            })
        }

        // Check expiration
        if (speaker.portal_token_expires && new Date(speaker.portal_token_expires) < new Date()) {
            throw createError({
                statusCode: 410,
                message: 'Token abgelaufen',
            })
        }

        // Check if already submitted
        if (speaker.portal_submission_status === 'submitted' || speaker.portal_submission_status === 'approved') {
            throw createError({
                statusCode: 409,
                message: 'Bereits eingereicht',
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
        if (err.statusCode) {
            throw err
        }
        console.error('Speaker portal submission error:', err)
        throw createError({
            statusCode: 500,
            message: 'Ein Fehler ist beim Speichern deiner Informationen aufgetreten.',
        })
    }
})
