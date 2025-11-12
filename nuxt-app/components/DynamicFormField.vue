<template>
    <div class="mb-6">
        <label :for="field.key" class="block text-sm font-medium text-gray-700 mb-2">
            {{ field.label }}
            <span v-if="field.required" class="text-red-500 ml-1">*</span>
        </label>
        
        <div v-if="field.description" class="text-sm text-gray-500 mb-2">
            {{ field.description }}
        </div>

        <!-- Text Input -->
        <input
            v-if="field.type === 'text'"
            :id="field.key"
            v-model="field.value"
            type="text"
            :required="field.required"
            :readonly="field.readonly"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            :class="{ 'bg-gray-50': field.readonly }"
        />

        <!-- Email Input -->
        <input
            v-else-if="field.type === 'email'"
            :id="field.key"
            v-model="field.value"
            type="email"
            :required="field.required"
            :readonly="field.readonly"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            :class="{ 'bg-gray-50': field.readonly }"
        />

        <!-- URL Input -->
        <input
            v-else-if="field.type === 'url'"
            :id="field.key"
            v-model="field.value"
            type="url"
            :required="field.required"
            :readonly="field.readonly"
            placeholder="https://..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            :class="{ 'bg-gray-50': field.readonly }"
        />

        <!-- Textarea -->
        <textarea
            v-else-if="field.type === 'textarea'"
            :id="field.key"
            v-model="field.value"
            rows="4"
            :required="field.required"
            :readonly="field.readonly"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            :class="{ 'bg-gray-50': field.readonly }"
        ></textarea>

        <!-- File Upload -->
        <div v-else-if="field.type === 'file'" class="space-y-2">
            <input
                :id="field.key"
                type="file"
                accept="image/*"
                @change="handleFileChange"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div v-if="uploadProgress > 0 && uploadProgress < 100" class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-blue-600 h-2.5 rounded-full" :style="`width: ${uploadProgress}%`"></div>
            </div>
            <div v-if="field.value" class="text-sm text-green-600">
                ✓ File uploaded successfully
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface FormField {
    key: string
    label: string
    type: 'text' | 'textarea' | 'email' | 'url' | 'file' | 'hidden'
    required: boolean
    value: any
    readonly: boolean
    description?: string
}

interface Props {
    field: FormField
    onFileUpload?: (fieldKey: string, file: File) => Promise<string | null>
}

const props = defineProps<Props>()

const uploadProgress = ref(0)

async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    
    if (!file || !props.onFileUpload) return

    try {
        uploadProgress.value = 50 // Show some progress
        const fileId = await props.onFileUpload(props.field.key, file)
        uploadProgress.value = 100
        
        // Reset progress after a short delay
        setTimeout(() => {
            uploadProgress.value = 0
        }, 2000)
    } catch (error) {
        console.error('File upload error:', error)
        uploadProgress.value = 0
    }
}
</script>