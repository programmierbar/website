import { ref, computed } from 'vue'
import type { DirectusField } from '@directus/types'

interface FormField {
    key: string
    label: string
    type: 'text' | 'textarea' | 'email' | 'url' | 'file' | 'hidden'
    required: boolean
    value: any
    options?: any
    readonly: boolean
    description?: string
}

/**
 * Composable for handling dynamic form generation based on Directus collection schema
 * This allows the speaker portal to automatically adapt to schema changes in Directus
 */
export function useDynamicSpeakerForm() {
    const { getSpeakersCollectionFields, getSpeakerByToken, updateSpeakerByToken, uploadFile } = usePublicDirectus()
    
    const fields = ref<FormField[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const success = ref<string | null>(null)

    // Fields that should be excluded from the public form
    const excludedFields = [
        'id',
        'date_created',
        'date_updated',
        'user_created',
        'user_updated',
        'status',
        'sort',
        'published_on',
        'listed_hof',
        'token', // The token field should not be editable
        'podcasts', // Relations to other collections
        'meetups',
        'tags',
        'picks_of_the_day'
    ]

    // Fields that should be readonly (displayed but not editable)
    const readonlyFields = [
        'slug' // Slug might be generated automatically
    ]

    /**
     * Convert Directus field type to form input type
     */
    function mapDirectusTypeToInputType(directusType: string, fieldName: string): FormField['type'] {
        if (fieldName.toLowerCase().includes('image') || fieldName.toLowerCase().includes('photo')) {
            return 'file'
        }
        
        switch (directusType) {
            case 'text':
            case 'string':
                if (fieldName.toLowerCase().includes('email')) return 'email'
                if (fieldName.toLowerCase().includes('url') || fieldName.toLowerCase().includes('website')) return 'url'
                return 'text'
            case 'json':
            case 'text':
                return 'textarea'
            case 'file':
            case 'image':
                return 'file'
            default:
                return 'text'
        }
    }

    /**
     * Generate form fields from Directus schema
     */
    function generateFormFields(schema: DirectusField[], speakerData: any): FormField[] {
        return schema
            .filter(field => !excludedFields.includes(field.field))
            .map(field => ({
                key: field.field,
                label: field.meta?.display_name || field.field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: mapDirectusTypeToInputType(field.type, field.field),
                required: field.meta?.required || false,
                value: speakerData[field.field] || '',
                readonly: readonlyFields.includes(field.field),
                description: field.meta?.note || undefined,
                options: field.meta?.options || undefined
            }))
    }

    /**
     * Load speaker data and generate form fields
     */
    async function loadSpeakerData(token: string) {
        loading.value = true
        error.value = null
        
        try {
            // Load both schema and speaker data in parallel
            const [schema, speakerData] = await Promise.all([
                getSpeakersCollectionFields(),
                getSpeakerByToken(token)
            ])

            fields.value = generateFormFields(schema, speakerData)
        } catch (err: any) {
            error.value = err.message || 'Failed to load speaker data'
        } finally {
            loading.value = false
        }
    }

    /**
     * Validate file before upload
     */
    function validateFile(file: File): string | null {
        const maxSize = 5 * 1024 * 1024 // 5MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

        if (!allowedTypes.includes(file.type)) {
            return 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)'
        }

        if (file.size > maxSize) {
            return 'File size must be less than 5MB'
        }

        return null
    }

    /**
     * Handle file upload for image fields
     */
    async function handleFileUpload(fieldKey: string, file: File): Promise<string | null> {
        try {
            // Validate file first
            const validationError = validateFile(file)
            if (validationError) {
                error.value = validationError
                return null
            }

            const uploadResult = await uploadFile(file)
            if (uploadResult && uploadResult.id) {
                // Update the form field value with the uploaded file ID
                const field = fields.value.find(f => f.key === fieldKey)
                if (field) {
                    field.value = uploadResult.id
                }
                return uploadResult.id
            }
            return null
        } catch (err: any) {
            const errorMsg = `File upload failed: ${err.message}`
            error.value = errorMsg
            throw new Error(errorMsg)
        }
    }

    /**
     * Validate form data
     */
    function validateForm(): string | null {
        const requiredFields = fields.value.filter(f => f.required && !f.readonly)
        
        for (const field of requiredFields) {
            if (!field.value || (typeof field.value === 'string' && field.value.trim() === '')) {
                return `${field.label} is required`
            }
            
            // Email validation
            if (field.type === 'email' && field.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (!emailRegex.test(field.value)) {
                    return `Please enter a valid email address for ${field.label}`
                }
            }
            
            // URL validation
            if (field.type === 'url' && field.value) {
                try {
                    new URL(field.value)
                } catch {
                    return `Please enter a valid URL for ${field.label}`
                }
            }
        }
        
        return null
    }

    /**
     * Submit form data
     */
    async function submitForm(token: string) {
        loading.value = true
        error.value = null
        success.value = null

        try {
            // Validate form first
            const validationError = validateForm()
            if (validationError) {
                error.value = validationError
                return
            }

            // Prepare data for submission (exclude readonly fields)
            const submitData: any = {}
            fields.value
                .filter(field => !field.readonly)
                .forEach(field => {
                    if (field.value !== undefined && field.value !== null && field.value !== '') {
                        submitData[field.key] = field.value
                    }
                })

            await updateSpeakerByToken(token, submitData)
            success.value = 'Your information has been successfully updated!'
        } catch (err: any) {
            if (err.message.includes('validation')) {
                error.value = 'Please check your input data for validation errors'
            } else if (err.message.includes('permission')) {
                error.value = 'You do not have permission to update this information'
            } else if (err.message.includes('network')) {
                error.value = 'Network error. Please check your connection and try again'
            } else {
                error.value = err.message || 'Failed to update your information. Please try again'
            }
        } finally {
            loading.value = false
        }
    }

    /**
     * Get form fields grouped by type for better UI organization
     */
    const formFieldsGrouped = computed(() => {
        const groups = {
            basic: fields.value.filter(f => ['text', 'email'].includes(f.type) && !f.key.includes('url')),
            social: fields.value.filter(f => f.key.includes('url')),
            content: fields.value.filter(f => f.type === 'textarea'),
            files: fields.value.filter(f => f.type === 'file'),
            readonly: fields.value.filter(f => f.readonly)
        }
        
        return groups
    })

    /**
     * Clear messages
     */
    function clearMessages() {
        error.value = null
        success.value = null
    }

    return {
        fields,
        formFieldsGrouped,
        loading,
        error,
        success,
        loadSpeakerData,
        handleFileUpload,
        submitForm,
        clearMessages
    }
}