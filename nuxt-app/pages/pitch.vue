<template>
    <div v-if="pitchPage" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ pitchPage.heading }}
            </SectionHeading>

            <!-- Text -->
            <InnerHtml
                class="mt-8 space-y-8 break-words text-base font-light text-white md:mt-16 md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                :html="pitchPage.text"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()
const breadcrumbs = [{ label: 'Pitch' }]

// Query pitch page (null while it is not published)
const { data: pitchPage, error } = await useAsyncData(() => directus.getPitchPage())

// Throw at setup level (not inside the useAsyncData handler, where it would
// only populate the error ref) so the response carries the correct status.
// A failed request is a server error and must not look like a 404.
if (error.value) {
    throw createError({
        statusCode: 500,
        statusMessage: error.value.message || 'Failed to load pitch page.',
        fatal: true,
        cause: error.value,
    })
}

// An unpublished page does not exist for visitors
if (!pitchPage.value) {
    throw createError({ statusCode: 404, statusMessage: 'The page was not found.', fatal: true })
}

// Set loading screen
useLoadingScreen(pitchPage)

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/pitch',
        title: 'Pitch',
        noIndex: true,
    })
)
</script>
