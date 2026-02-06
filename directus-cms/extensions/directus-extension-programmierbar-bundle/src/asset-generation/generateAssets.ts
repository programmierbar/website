import { Buffer } from 'buffer'
import { Readable } from 'stream'
import type { Logger } from 'pino'

interface HookServices {
    logger: Logger
    ItemsService: any
    FilesService: any
    AssetsService: any
    getSchema: () => Promise<any>
    env: Record<string, string>
    accountability: any
}

interface AssetTemplate {
    id: number
    name: string
    asset_type: string
    episode_type: string | null
    active: boolean
    requires_speaker_image: boolean
    template_image: string | null
    prompt_template: string
    variables_schema: string | null
    generation_model: string | null
    output_format: string | null
}

interface PodcastData {
    id: number
    title: string
    type: string
    number: string
    assets_status?: string | null
    cover_image?: string | null
    banner_image?: string | null
    speakers?: Array<{
        speaker: {
            id: number
            first_name: string
            last_name: string
            occupation?: string
            description?: string
            profile_image?: string
        }
    }>
    members?: Array<{
        member: {
            first_name: string
            last_name: string
        }
    }>
}

interface FileData {
    id: string
    filename_disk?: string
    type?: string
    storage?: string
}

// Default Gemini model for image generation
const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview'

// Episode type display names
const EPISODE_TYPE_DISPLAY: Record<string, string> = {
    deep_dive: 'Deep Dive',
    cto_special: 'CTO Special',
    news: 'News',
    other: 'Episode',
}

/**
 * Simple template renderer for Handlebars-like syntax
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
    let result = template

    // Handle simple variables {{variable}}
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        result = result.replace(regex, value || '')
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
    result = result.replace(ifBlockRegex, (_, varName, content) => {
        return variables[varName] ? content : ''
    })

    return result
}

/**
 * Fetch file data from Directus and convert to base64
 * Uses Directus AssetsService to handle any storage driver (local, S3, etc.)
 */
async function getFileAsBase64(
    fileId: string,
    filesService: any,
    assetsService: any,
    logger: Logger
): Promise<{ base64: string; mimeType: string } | null> {
    try {
        // Get file metadata
        const file: FileData = await filesService.readOne(fileId, {
            fields: ['id', 'filename_disk', 'type'],
        })

        if (!file || !file.filename_disk) {
            logger.warn(`File ${fileId} not found or has no filename_disk`)
            return null
        }

        const mimeType = file.type || 'image/png'

        // Use AssetsService to get the file stream (works with any storage driver)
        const { stream } = await assetsService.getAsset(fileId, {})

        const chunks: Buffer[] = []
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        const fileBuffer = Buffer.concat(chunks)

        const base64 = fileBuffer.toString('base64')
        logger.info(`Successfully read file ${fileId} (${fileBuffer.length} bytes)`)

        return { base64, mimeType }
    } catch (err: any) {
        logger.error(`Error fetching file ${fileId}: ${err.message}`)
        return null
    }
}

/**
 * Call Gemini API for image generation
 * Uses responseModalities: ['TEXT', 'IMAGE'] as per Gemini image generation API
 */
async function generateImageWithGemini(
    apiKey: string,
    prompt: string,
    inputImages: Array<{ base64: string; mimeType: string }>,
    model: string,
    logger: Logger
): Promise<{ imageBase64: string; mimeType: string } | null> {
    // Build the request parts
    const parts: any[] = []

    // Add input images first (template image, speaker image, etc.)
    for (const img of inputImages) {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.base64,
            },
        })
    }

    // Add the text prompt
    parts.push({ text: prompt })

    const requestBody = {
        contents: [{ parts }],
        generationConfig: {
            // Request both text and image output - this is the correct format for image generation
            responseModalities: ['TEXT', 'IMAGE'],
        },
    }

    logger.info(`Calling Gemini model ${model} for image generation`)

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`Gemini API error: ${response.status} - ${errorText}`)
        throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()

    // Extract the generated image from the response
    const candidate = data.candidates?.[0]
    if (!candidate) {
        logger.warn('No candidates in Gemini response')
        return null
    }

    // Check for image data in the response - Gemini returns JPEG by default
    const imagePart = candidate.content?.parts?.find(
        (part: any) => part.inlineData?.mimeType?.startsWith('image/')
    )

    if (imagePart?.inlineData) {
        return {
            imageBase64: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || 'image/jpeg',
        }
    }

    // If no image, check if there's text (might be an error or the model doesn't support image generation)
    const textPart = candidate.content?.parts?.find((part: any) => part.text)
    if (textPart) {
        logger.warn(`Gemini returned text instead of image: ${textPart.text.substring(0, 200)}`)
    }

    return null
}

/**
 * Build template variables from podcast and speaker data
 */
function buildTemplateVariables(
    podcast: PodcastData,
    speaker?: { first_name: string; last_name: string; occupation?: string }
): Record<string, string> {
    const speakerName = speaker ? `${speaker.first_name} ${speaker.last_name}`.trim() : ''

    return {
        number: podcast.number || '',
        title: podcast.title || '',
        episode_type: podcast.type || 'other',
        episode_type_display: EPISODE_TYPE_DISPLAY[podcast.type] || 'Episode',
        speaker_name: speakerName,
        speaker_occupation: speaker?.occupation || '',
        hosts:
            podcast.members
                ?.map((m) => `${m.member?.first_name} ${m.member?.last_name}`.trim())
                .filter(Boolean)
                .join(', ') || 'programmier.bar Team',
    }
}

/**
 * Generate assets for a single podcast
 */
export async function generateAssetsForPodcast(hookName: string, podcastId: number, services: HookServices): Promise<void> {
    const { logger, ItemsService, FilesService, AssetsService, getSchema, env, accountability } = services
    const geminiApiKey = env.GEMINI_API_KEY

    if (!geminiApiKey) {
        logger.error(`${hookName}: GEMINI_API_KEY not configured, skipping asset generation`)
        return
    }

    try {
        const schema = await getSchema()

        // Create services
        const podcastsService = new ItemsService('podcasts', {
            schema,
            accountability,
        })

        const templatesService = new ItemsService('asset_templates', {
            schema,
            accountability,
        })

        const generatedAssetsService = new ItemsService('podcast_generated_assets', {
            schema,
            accountability,
        })

        const filesService = new FilesService({
            schema,
            accountability,
        })

        const assetsService = new AssetsService({
            schema,
            accountability,
        })

        // Fetch podcast with related data
        const podcast: PodcastData = await podcastsService.readOne(podcastId, {
            fields: [
                'id',
                'title',
                'type',
                'number',
                'assets_status',
                'cover_image',
                'banner_image',
                'speakers.speaker.id',
                'speakers.speaker.first_name',
                'speakers.speaker.last_name',
                'speakers.speaker.occupation',
                'speakers.speaker.description',
                'speakers.speaker.profile_image',
                'members.member.first_name',
                'members.member.last_name',
            ],
        })

        if (!podcast) {
            logger.warn(`${hookName}: Podcast ${podcastId} not found`)
            return
        }

        logger.info(`${hookName}: Generating assets for podcast: ${podcast.title} (${podcast.type} ${podcast.number})`)

        // Update assets status to generating
        await podcastsService.updateOne(podcastId, {
            assets_status: 'generating',
        })

        // Fetch active templates that match this podcast's episode type
        const templates: AssetTemplate[] = await templatesService.readByQuery({
            filter: {
                active: { _eq: true },
                _or: [{ episode_type: { _eq: podcast.type } }, { episode_type: { _null: true } }],
            },
            fields: [
                'id',
                'name',
                'asset_type',
                'episode_type',
                'active',
                'requires_speaker_image',
                'template_image',
                'prompt_template',
                'variables_schema',
                'generation_model',
                'output_format',
            ],
        })

        if (!templates || templates.length === 0) {
            logger.warn(`${hookName}: No active templates found for podcast type ${podcast.type}`)
            await podcastsService.updateOne(podcastId, {
                assets_status: 'complete',
            })
            return
        }

        logger.info(`${hookName}: Found ${templates.length} template(s) to process`)

        // Get the primary speaker (first one)
        // NOTE: Currently only the first speaker is used for asset generation.
        // Multi-speaker episodes (e.g., panel discussions) will only feature the first speaker
        // in generated assets. This is intentional for typical Deep Dive episodes with one guest.
        // See docs/asset_generation.md for more details.
        const primarySpeaker = podcast.speakers?.[0]?.speaker
        const speakerProfileImageId = primarySpeaker?.profile_image

        // Track generation results
        let successCount = 0
        let failCount = 0

        // Process each template
        for (const template of templates) {
            try {
                logger.info(`${hookName}: Processing template: ${template.name}`)

                // Check if speaker image is required but not available
                if (template.requires_speaker_image && !speakerProfileImageId) {
                    logger.warn(
                        `${hookName}: Template ${template.name} requires speaker image, but none available - skipping`
                    )
                    continue
                }

                // Build template variables
                const variables = buildTemplateVariables(podcast, primarySpeaker)

                // Render the prompt
                const renderedPrompt = renderTemplate(template.prompt_template, variables)

                // Collect input images
                const inputImages: Array<{ base64: string; mimeType: string }> = []

                // Add template image if available
                if (template.template_image) {
                    const templateImageData = await getFileAsBase64(
                        template.template_image,
                        filesService,
                        assetsService,
                        logger
                    )
                    if (templateImageData) {
                        inputImages.push(templateImageData)
                    }
                }

                // Add speaker profile image if required and available
                if (template.requires_speaker_image && speakerProfileImageId) {
                    const speakerImageData = await getFileAsBase64(speakerProfileImageId, filesService, assetsService, logger)
                    if (speakerImageData) {
                        inputImages.push(speakerImageData)
                    }
                }

                // Generate the image
                const model = template.generation_model || DEFAULT_IMAGE_MODEL
                const generatedImage = await generateImageWithGemini(
                    geminiApiKey,
                    renderedPrompt,
                    inputImages,
                    model,
                    logger
                )

                if (!generatedImage) {
                    logger.error(`${hookName}: Failed to generate image for template ${template.name}`)

                    // Record the failure
                    await generatedAssetsService.createOne({
                        podcast_id: podcastId,
                        template_id: template.id,
                        asset_type: template.asset_type,
                        status: 'failed',
                        generation_prompt: renderedPrompt,
                        error_message: 'Image generation returned no result',
                        generation_model: model,
                    })

                    failCount++
                    continue
                }

                // Upload the generated image to Directus
                // Gemini returns JPEG by default, so use the actual mimeType from the response
                const actualMimeType = generatedImage.mimeType || 'image/jpeg'
                // Extract extension from mime type, handling common cases
                const extension = actualMimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
                const filename = `${podcast.type}-${podcast.number}-${template.asset_type}-${Date.now()}.${extension}`
                const fileTitle = `${podcast.title} - ${template.asset_type}`

                logger.info(`${hookName}: Uploading generated asset: ${filename}`)

                // Convert base64 to buffer, then to readable stream for Directus
                const imageBuffer = Buffer.from(generatedImage.imageBase64, 'base64')
                const imageStream = Readable.from(imageBuffer)

                const fileId = await filesService.uploadOne(imageStream, {
                    title: fileTitle,
                    type: actualMimeType,
                    filename_download: filename,
                    storage: env.STORAGE_LOCATIONS?.split(',')[0] || 'local',
                })

                // Create the generated asset record
                await generatedAssetsService.createOne({
                    podcast_id: podcastId,
                    template_id: template.id,
                    asset_type: template.asset_type,
                    status: 'generated',
                    generated_file: fileId,
                    generation_prompt: renderedPrompt,
                    generation_model: model,
                    generated_at: new Date().toISOString(),
                })

                // Auto-link certain asset types to the podcast (only if not already set)
                if (template.asset_type === 'episode_cover' && !podcast.cover_image) {
                    await podcastsService.updateOne(podcastId, {
                        cover_image: fileId,
                    })
                    logger.info(`${hookName}: Updated podcast cover_image to ${fileId}`)
                } else if (template.asset_type === 'episode_cover' && podcast.cover_image) {
                    logger.info(`${hookName}: Skipping cover_image update - already has a value`)
                } else if (template.asset_type === 'heise_banner' && !podcast.banner_image) {
                    await podcastsService.updateOne(podcastId, {
                        banner_image: fileId,
                    })
                    logger.info(`${hookName}: Updated podcast banner_image to ${fileId}`)
                } else if (template.asset_type === 'heise_banner' && podcast.banner_image) {
                    logger.info(`${hookName}: Skipping banner_image update - already has a value`)
                }

                successCount++
                logger.info(`${hookName}: Successfully generated ${template.asset_type} for podcast ${podcastId}`)
            } catch (err: any) {
                logger.error(`${hookName}: Error processing template ${template.name}: ${err.message}`)

                // Record the failure
                await generatedAssetsService.createOne({
                    podcast_id: podcastId,
                    template_id: template.id,
                    asset_type: template.asset_type,
                    status: 'failed',
                    error_message: err.message,
                })

                failCount++
            }
        }

        // Update final status
        let finalStatus: string
        if (failCount > 0 && successCount === 0) {
            finalStatus = 'failed'
        } else if (failCount > 0 && successCount > 0) {
            finalStatus = 'partial'
            logger.warn(
                `${hookName}: Some asset generations failed for podcast ${podcastId}. Success: ${successCount}, Failed: ${failCount}`
            )
        } else {
            finalStatus = 'complete'
        }

        await podcastsService.updateOne(podcastId, {
            assets_status: finalStatus,
        })

        logger.info(
            `${hookName}: Asset generation ${finalStatus} for podcast ${podcastId}. Success: ${successCount}, Failed: ${failCount}`
        )
    } catch (err: any) {
        logger.error(`${hookName}: Asset generation error for podcast ${podcastId}: ${err.message}`)
        if (err.stack) {
            logger.error(`${hookName}: Stack trace: ${err.stack}`)
        }

        // Try to update status to failed
        try {
            const failSchema = await getSchema()
            const podcastsService = new ItemsService('podcasts', {
                schema: failSchema,
                accountability,
            })
            await podcastsService.updateOne(podcastId, {
                assets_status: 'failed',
            })
        } catch {
            // Ignore errors updating status
        }

        throw err
    }
}

/**
 * Regenerate assets for a podcast (deletes existing and creates new)
 */
export async function regenerateAssets(hookName: string, podcastId: number, services: HookServices): Promise<void> {
    const { logger, ItemsService, FilesService, getSchema, accountability } = services

    try {
        const schema = await getSchema()

        // Delete existing generated assets for this podcast
        const generatedAssetsService = new ItemsService('podcast_generated_assets', {
            schema,
            accountability,
        })

        const filesService = new FilesService({
            schema,
            accountability,
        })

        const existingAssets = await generatedAssetsService.readByQuery({
            filter: { podcast_id: { _eq: podcastId } },
            fields: ['id', 'generated_file'],
        })

        if (existingAssets && existingAssets.length > 0) {
            // Collect file IDs to delete (filter out null/undefined)
            const fileIds = existingAssets
                .map((a: { id: number; generated_file?: string }) => a.generated_file)
                .filter(Boolean)

            // Delete the asset records first
            const assetIds = existingAssets.map((a: { id: number }) => a.id)
            logger.info(`${hookName}: Deleting ${assetIds.length} existing asset record(s) for podcast ${podcastId}`)
            await generatedAssetsService.deleteMany(assetIds)

            // Then delete the associated files from directus_files
            if (fileIds.length > 0) {
                logger.info(`${hookName}: Deleting ${fileIds.length} associated file(s) for podcast ${podcastId}`)
                try {
                    await filesService.deleteMany(fileIds)
                } catch (fileErr: any) {
                    // Log but don't fail if file deletion fails (files may already be deleted or referenced elsewhere)
                    logger.warn(`${hookName}: Some files could not be deleted: ${fileErr.message}`)
                }
            }
        }

        // Generate new assets
        await generateAssetsForPodcast(hookName, podcastId, services)
    } catch (err: any) {
        logger.error(`${hookName}: Regeneration error for podcast ${podcastId}: ${err.message}`)
        throw err
    }
}
