import { z } from 'zod'

const speakerDataSchema = z.object({
    academic_title: z.string().max(50).optional().nullable(),
    first_name: z.string().min(1, 'Vorname ist erforderlich').max(100),
    last_name: z.string().min(1, 'Nachname ist erforderlich').max(100),
    occupation: z.string().min(1, 'Jobtitel und Unternehmen sind erforderlich').max(200),
    description: z.string().min(1, 'Beschreibung ist erforderlich').max(2000),
    website_url: z.string().url().max(500).optional().or(z.literal('')),
    linkedin_url: z.string().url().max(500).optional().or(z.literal('')),
    twitter_url: z.string().url().max(500).optional().or(z.literal('')),
    bluesky_url: z.string().max(100).optional().or(z.literal('')),
    github_url: z.string().url().max(500).optional().or(z.literal('')),
    instagram_url: z.string().url().max(500).optional().or(z.literal('')),
    youtube_url: z.string().url().max(500).optional().or(z.literal('')),
    mastodon_url: z.string().url().max(500).optional().or(z.literal('')),
})

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
    const parseResult = speakerDataSchema.safeParse(rawData)
    if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]
        throw createError({
            statusCode: 400,
            message: firstError?.message || 'Ungültige Formulardaten',
        })
    }
    const data = parseResult.data

    const config = useRuntimeConfig()
    const directusUrl = config.public.directusCmsUrl || 'http://localhost:8055'

    // Get admin token for Directus API access
    const adminToken = config.directusAdminToken

    if (!adminToken) {
        console.error('DIRECTUS_ADMIN_TOKEN not configured')
        throw createError({
            statusCode: 500,
            message: 'Serverkonfigurationsfehler',
        })
    }

    try {
        // Validate token and get speaker
        const validateResponse = await fetch(
            `${directusUrl}/items/speakers?filter[portal_token][_eq]=${encodeURIComponent(token)}&fields=id,portal_token_expires,portal_submission_status`,
            {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            }
        )

        if (!validateResponse.ok) {
            throw new Error('Failed to validate token')
        }

        const validateData = await validateResponse.json()

        if (!validateData.data || validateData.data.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Ungültiger Token',
            })
        }

        const speaker = validateData.data[0]

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

            const uploadResponse = await fetch(`${directusUrl}/files`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                body: imageFormData,
            })

            if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json()
                profileImageId = uploadData.data.id
            } else {
                const errorText = await uploadResponse.text()
                console.error('Failed to upload profile image:', errorText)
                throw createError({
                    statusCode: 500,
                    message: 'Profilbild konnte nicht hochgeladen werden. Bitte versuche es erneut.',
                })
            }
        }

        if (actionImage) {
            const imageFormData = new FormData()
            const blob = new Blob([actionImage.data], { type: actionImage.type })
            imageFormData.append('file', blob, actionImage.filename)

            const uploadResponse = await fetch(`${directusUrl}/files`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                body: imageFormData,
            })

            if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json()
                actionImageId = uploadData.data.id
            } else {
                const errorText = await uploadResponse.text()
                console.error('Failed to upload action image:', errorText)
                throw createError({
                    statusCode: 500,
                    message: 'Action Shot konnte nicht hochgeladen werden. Bitte versuche es erneut.',
                })
            }
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

        const updateResponse = await fetch(`${directusUrl}/items/speakers/${speaker.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(updateData),
        })

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text()
            console.error('Failed to update speaker:', errorText)
            throw new Error('Failed to save speaker data')
        }

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
