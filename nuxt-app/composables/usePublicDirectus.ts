import { createDirectus, rest, readItems, updateItem } from '@directus/sdk'
import { DIRECTUS_CMS_URL } from '~/config'
import type { Collections } from '~/services'

/**
 * Creates a public Directus client that can be used without authentication
 * This is specifically designed for the speaker info portal where speakers
 * can update their own data using a token-based system
 */
export function usePublicDirectus() {
    const publicDirectus = createDirectus<Collections>(DIRECTUS_CMS_URL).with(rest())

    /**
     * Get speaker data by token
     * The token should be stored in a field in the speakers collection
     * We need to filter by the token field rather than use it as ID
     */
    async function getSpeakerByToken(token: string) {
        try {
            const result = await publicDirectus.request(
                readItems('speakers', {
                    fields: ['*'],
                    filter: {
                        token: { _eq: token }
                    },
                    limit: 1
                })
            )
            
            if (!result || result.length === 0) {
                throw new Error('Invalid token or speaker not found')
            }
            
            return result[0]
        } catch (error) {
            console.error('Error fetching speaker by token:', error)
            throw error
        }
    }

    /**
     * Get the schema/fields for the speakers collection
     * This allows us to dynamically generate forms based on the actual database schema
     */
    async function getSpeakersCollectionFields() {
        try {
            // Use direct fetch since readCollectionFields might not be available in public API
            const response = await fetch(`${DIRECTUS_CMS_URL}/fields/speakers`)
            if (!response.ok) {
                throw new Error(`Failed to fetch schema: ${response.statusText}`)
            }
            const result = await response.json()
            return result.data
        } catch (error) {
            console.error('Error fetching speakers collection fields:', error)
            throw error
        }
    }

    /**
     * Update speaker data by token
     * First find the speaker by token, then update by ID
     */
    async function updateSpeakerByToken(token: string, data: Partial<any>) {
        try {
            // First get the speaker to find their ID
            const speaker = await getSpeakerByToken(token)
            
            // Update by the actual ID
            const result = await publicDirectus.request(
                updateItem('speakers', speaker.id, data)
            )
            return result
        } catch (error) {
            console.error('Error updating speaker by token:', error)
            throw error
        }
    }

    /**
     * Upload files (e.g., profile images)
     */
    async function uploadFile(file: File) {
        try {
            const formData = new FormData()
            formData.append('file', file)

            // Upload via direct fetch to /files endpoint since uploadFiles might not work with public API
            const response = await fetch(`${DIRECTUS_CMS_URL}/files`, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`)
            }

            const result = await response.json()
            return result.data
        } catch (error) {
            console.error('Error uploading file:', error)
            throw error
        }
    }

    /**
     * Validate if a token exists and points to a valid speaker
     */
    async function validateSpeakerToken(token: string): Promise<boolean> {
        try {
            await getSpeakerByToken(token)
            return true
        } catch {
            return false
        }
    }

    return {
        getSpeakerByToken,
        getSpeakersCollectionFields,
        updateSpeakerByToken,
        uploadFile,
        validateSpeakerToken
    }
}