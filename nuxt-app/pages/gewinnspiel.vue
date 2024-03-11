<template>
    <div v-if="rafflePage" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ rafflePage.heading }}
            </SectionHeading>

            <!-- Text -->
            <InnerHtml
                class="mt-8 space-y-8 break-words text-base font-light text-white md:mt-16 md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                :html="rafflePage.text"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()

const breadcrumbs = [{ label: 'Teilnahmebedingungen und Datenschutz zum Gewinnspiel' }]

// Query raffle page
const { data: rafflePage } = useAsyncData(() => directus.getRafflePage())

if (rafflePage.value && rafflePage.value.status !== 'published') {
    throw new Error('The page was not found.')
}

// Set loading screen
useLoadingScreen(rafflePage)

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/gewinnspiel',
        title: 'Teilnahmebedingungen und Datenschutz zum Gewinnspiel',
        noIndex: true,
    })
)
</script>
