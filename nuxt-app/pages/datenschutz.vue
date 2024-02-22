<template>
    <div v-if="privacyPage" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ privacyPage.heading }}
            </SectionHeading>

            <!-- Text -->
            <InnerHtml
                class="mt-8 space-y-8 break-words text-base font-light text-white md:mt-16 md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                :html="privacyPage.text"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()

const breadcrumbs = [{ label: 'Datenschutz' }]
// Query privacy page
const { data: privacyPage } = useAsyncData(() => directus.getPrivacyPage())

// Set loading screen
useLoadingScreen(privacyPage)

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/datenschutz',
        title: 'Datenschutz',
        noIndex: true,
    })
)
</script>
