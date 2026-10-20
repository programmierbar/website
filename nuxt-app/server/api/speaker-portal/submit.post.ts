import { SPEAKER_PORTAL_STATUS } from 'shared-code'
import { SpeakerSubmissionSchema } from '../../utils/schema'
import { hasVisibleText, markdownToHtml } from '../../utils/speakerBio'
import {
    getSpeakerPortalMode,
    isSpeakerPortalClosed,
    reportSpeakerProfileUpdateFailure,
    saveSpeakerProfileUpdate,
    SPEAKER_PROFILE_UPDATE_FAILURE_STAGE,
} from '../../utils/speakerProfileUpdate'

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
        // The form sends Markdown; the CMS field and every page rendering it expect rich text. Converted
        // before anything is stored: the schema only sees the Markdown, and a bio made of nothing but
        // an image or raw HTML would otherwise be saved empty and the token burned with it.
        const description = markdownToHtml(data.description)
        if (!hasVisibleText(description)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Bad Request',
                message:
                    'Bitte fülle das Feld „Bio / Beschreibung“ mit Text aus. Bilder und HTML-Code werden nicht übernommen.',
            })
        }

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
        if (isSpeakerPortalClosed(speaker.portal_submission_status)) {
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

        // The profile as submitted. Empty optional fields are stored as null, so removing a link in
        // the form removes it from the profile.
        const profile: Record<string, any> = {
            academic_title: data.academic_title || null,
            first_name: data.first_name,
            last_name: data.last_name,
            occupation: data.occupation,
            description,
            website_url: data.website_url || null,
            linkedin_url: data.linkedin_url || null,
            twitter_url: data.twitter_url || null,
            bluesky_url: data.bluesky_url || null,
            github_url: data.github_url || null,
            instagram_url: data.instagram_url || null,
            youtube_url: data.youtube_url || null,
            mastodon_url: data.mastodon_url || null,
        }

        if (profileImageId) {
            profile.profile_image = profileImageId
        }
        if (actionImageId) {
            profile.event_image = actionImageId
        }

        // Marks the submission done and makes the link single-use. This write also fires the CMS's
        // submission confirmation (mail to the speaker, Slack to the team).
        const completion = {
            portal_submission_status: SPEAKER_PORTAL_STATUS.submitted,
            portal_token: null,
        }

        const mode = getSpeakerPortalMode(speaker.portal_submission_status)
        if (mode === 'update') {
            // An existing profile: the changes go into a Content Version for an admin to
            // review and promote, the live item only learns that the speaker is done. The version is
            // saved first, so a failure there leaves the token usable for another try. The team hears
            // about it in Slack (via the CMS), since the speaker may not try again.
            try {
                await saveSpeakerProfileUpdate(directus, speaker, profile)
            } catch (err) {
                await reportSpeakerProfileUpdateFailure(
                    directus,
                    speaker.id,
                    SPEAKER_PROFILE_UPDATE_FAILURE_STAGE.saveVersion,
                    err
                )
                throw err
            }
            try {
                await directus.updateSpeaker(speaker.id, completion)
            } catch (err) {
                // The changes are in the version, but the speaker stays `update_requested` and gets no
                // confirmation: without a report the saved version could go unnoticed.
                await reportSpeakerProfileUpdateFailure(
                    directus,
                    speaker.id,
                    SPEAKER_PROFILE_UPDATE_FAILURE_STAGE.complete,
                    err
                )
                throw err
            }
        } else {
            await directus.updateSpeaker(speaker.id, { ...profile, ...completion })
        }

        return {
            success: true,
            mode,
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
