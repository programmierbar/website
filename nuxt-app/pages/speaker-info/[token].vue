<template>
    <div class="min-h-screen bg-gray-50 py-8">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">
                    Speaker Information Portal
                </h1>
                <p class="text-lg text-gray-600">
                    Update your speaker profile information
                </p>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex justify-center items-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <span class="ml-3 text-lg text-gray-600">Loading your information...</span>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-800">
                            Access Denied
                        </h3>
                        <div class="mt-2 text-sm text-red-700">
                            <p>{{ error }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Success Message -->
            <div v-if="success" class="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-green-800">
                            {{ success }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Form Content -->
            <div v-if="!loading && !error && formFieldsGrouped" class="bg-white shadow rounded-lg">
                <form @submit.prevent="handleSubmit" class="divide-y divide-gray-200">
                    
                    <!-- Basic Information Section -->
                    <div v-if="formFieldsGrouped.basic.length > 0" class="p-6">
                        <h2 class="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DynamicFormField
                                v-for="field in formFieldsGrouped.basic"
                                :key="field.key"
                                :field="field"
                                :on-file-upload="handleFileUpload"
                            />
                        </div>
                    </div>

                    <!-- Content Section -->
                    <div v-if="formFieldsGrouped.content.length > 0" class="p-6">
                        <h2 class="text-lg font-medium text-gray-900 mb-4">Biography & Description</h2>
                        <div class="space-y-6">
                            <DynamicFormField
                                v-for="field in formFieldsGrouped.content"
                                :key="field.key"
                                :field="field"
                                :on-file-upload="handleFileUpload"
                            />
                        </div>
                    </div>

                    <!-- Social Media & Links Section -->
                    <div v-if="formFieldsGrouped.social.length > 0" class="p-6">
                        <h2 class="text-lg font-medium text-gray-900 mb-4">Social Media & Links</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DynamicFormField
                                v-for="field in formFieldsGrouped.social"
                                :key="field.key"
                                :field="field"
                                :on-file-upload="handleFileUpload"
                            />
                        </div>
                    </div>

                    <!-- Files Section -->
                    <div v-if="formFieldsGrouped.files.length > 0" class="p-6">
                        <h2 class="text-lg font-medium text-gray-900 mb-4">Images & Files</h2>
                        <div class="space-y-6">
                            <DynamicFormField
                                v-for="field in formFieldsGrouped.files"
                                :key="field.key"
                                :field="field"
                                :on-file-upload="handleFileUpload"
                            />
                        </div>
                    </div>

                    <!-- Readonly Information Section -->
                    <div v-if="formFieldsGrouped.readonly.length > 0" class="p-6">
                        <h2 class="text-lg font-medium text-gray-900 mb-4">System Information (Read-only)</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DynamicFormField
                                v-for="field in formFieldsGrouped.readonly"
                                :key="field.key"
                                :field="field"
                                :on-file-upload="handleFileUpload"
                            />
                        </div>
                    </div>

                    <!-- Submit Section -->
                    <div class="p-6 bg-gray-50">
                        <div class="flex justify-between">
                            <button
                                type="button"
                                @click="clearMessages"
                                class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Clear Messages
                            </button>
                            <button
                                type="submit"
                                :disabled="loading"
                                class="bg-indigo-600 py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span v-if="loading">Updating...</span>
                                <span v-else>Update Information</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Help Section -->
            <div class="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-blue-800">
                            Need Help?
                        </h3>
                        <div class="mt-2 text-sm text-blue-700">
                            <p>This portal allows you to update your speaker profile information. Any changes you make will be reflected on the programmier.bar website after you submit the form.</p>
                            <p class="mt-1">If you have questions or encounter issues, please contact us at <a href="mailto:kontakt@programmier.bar" class="underline">kontakt@programmier.bar</a>.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: false // Use no layout for this portal page
})

const route = useRoute()
const token = route.params.token as string

// Validate token format (basic check)
if (!token || token.length < 10) {
    throw createError({
        statusCode: 400,
        statusMessage: 'Invalid or missing token'
    })
}

const { 
    formFieldsGrouped, 
    loading, 
    error, 
    success, 
    loadSpeakerData, 
    handleFileUpload, 
    submitForm, 
    clearMessages 
} = useDynamicSpeakerForm()

// Load data on mount
onMounted(async () => {
    try {
        await loadSpeakerData(token)
    } catch (err) {
        console.error('Failed to load speaker data:', err)
    }
})

// Handle form submission
async function handleSubmit() {
    try {
        await submitForm(token)
    } catch (err) {
        console.error('Form submission failed:', err)
    }
}

// SEO Meta
useHead({
    title: 'Speaker Information Portal - programmier.bar',
    meta: [
        { name: 'description', content: 'Update your speaker profile information for programmier.bar' },
        { name: 'robots', content: 'noindex, nofollow' } // Don't index this page
    ]
})
</script>