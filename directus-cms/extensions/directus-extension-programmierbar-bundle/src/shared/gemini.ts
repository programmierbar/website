import type { Logger } from 'pino'

/**
 * Shared Gemini API utilities.
 *
 * Consolidates all LLM API calls and key handling in one place so that
 * individual extensions do not need to worry about API URLs or key management.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Call Gemini for text generation.
 */
export async function callGemini(apiKey: string, prompt: string, model = 'gemini-3-flash-preview'): Promise<string> {
    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            },
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
        throw new Error('No content in Gemini response')
    }

    return text
}

/**
 * Call Gemini for image generation.
 * Uses responseModalities: ['TEXT', 'IMAGE'] as per Gemini image generation API.
 */
export async function generateImageWithGemini(
    apiKey: string,
    prompt: string,
    inputImages: Array<{ base64: string; mimeType: string }>,
    model: string,
    logger: Logger
): Promise<{ imageBase64: string; mimeType: string } | null> {
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
            responseModalities: ['TEXT', 'IMAGE'],
        },
    }

    logger.info(`Calling Gemini model ${model} for image generation`)

    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`Gemini API error: ${response.status} - ${errorText}`)
        throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()

    const candidate = data.candidates?.[0]
    if (!candidate) {
        logger.warn('No candidates in Gemini response')
        return null
    }

    // Check for image data in the response
    const imagePart = candidate.content?.parts?.find(
        (part: any) => part.inlineData?.mimeType?.startsWith('image/')
    )

    if (imagePart?.inlineData) {
        return {
            imageBase64: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || 'image/jpeg',
        }
    }

    // If no image, check if there's text (model might not support image generation)
    const textPart = candidate.content?.parts?.find((part: any) => part.text)
    if (textPart) {
        logger.warn(`Gemini returned text instead of image: ${textPart.text.substring(0, 200)}`)
    }

    return null
}

/**
 * Extract JSON from a Gemini text response.
 * Handles responses wrapped in markdown code blocks.
 */
export function extractJson(text: string): any {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        return JSON.parse(jsonStr)
    }
    throw new Error('Could not extract JSON from response')
}
