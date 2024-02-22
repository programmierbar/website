<template>
    <div v-if="imprintPage" class="relative">
        <div class="3xl:px-8 container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ imprintPage.heading }}
            </SectionHeading>

            <!-- Text -->
            <InnerHtml
                class="mt-8 space-y-8 break-words text-base font-light text-white md:mt-16 md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                :html="imprintPage.text"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'
import { directus } from '../services'
import type { ImprintPage } from '../types'

const breadcrumbs = [{ label: 'Impressum' }]

// Query imprint page
const { data: imprintPage } = await useAsyncData(
    () => directus.singleton('imprint_page').read() as Promise<ImprintPage>
)

// Set loading screen
useLoadingScreen(imprintPage)

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/impressum',
        title: 'Impressum',
        noIndex: true,
    })
)
</script>
