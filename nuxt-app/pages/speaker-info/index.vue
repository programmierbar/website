<template>
    <div class="min-h-screen bg-gray-50 py-8">
        <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h1 class="text-3xl font-bold text-gray-900 mb-4">
                    Speaker Information Portal
                </h1>
                
                <div class="bg-red-50 border border-red-200 rounded-md p-6">
                    <div class="flex justify-center mb-4">
                        <svg class="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    
                    <h2 class="text-xl font-medium text-red-800 mb-2">
                        Access Token Required
                    </h2>
                    
                    <p class="text-red-700 mb-4">
                        To access this speaker portal, you need a valid access token. This token should be provided to you directly by the programmier.bar team.
                    </p>
                    
                    <p class="text-sm text-red-600">
                        If you believe you should have access to this portal, please contact us at 
                        <a href="mailto:kontakt@programmier.bar" class="underline font-medium">
                            kontakt@programmier.bar
                        </a>
                    </p>
                </div>
                
                <div class="mt-8">
                    <NuxtLink to="/" class="text-indigo-600 hover:text-indigo-500 font-medium">
                        ← Back to programmier.bar
                    </NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: false
})

useHead({
    title: 'Speaker Portal - Access Required - programmier.bar',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }
    ]
})
</script>