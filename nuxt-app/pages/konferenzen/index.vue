<template>
    <div v-if="conferencePage">
        <section class="relative">
            <!-- Page cover -->
            <PageCoverImage :cover-image="conferencePage.cover_image" v-if="conferencePage.cover_image" />
            <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />

                <!-- Page intro -->
                <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                    {{ conferencePage.conference_heading }}
                </SectionHeading>

                <InnerHtml
                    class="mt-8 text-lg font-bold leading-normal text-white md:mt-16 md:text-2xl md:leading-normal lg:text-3xl lg:leading-normal"
                    :html="conferencePage.intro_text_1"
                />
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen, usePageMeta } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusConferencePage } from '~/types';
import { computed, type ComputedRef } from 'vue'

const breadcrumbs = [{ label: 'Konferenzen' }]
const directus = useDirectus()

// Query meetup page and meetups
const { data: pageData } = useAsyncData(async () => {
    const [conferencePage] = await Promise.all([directus.getConferencePage()])

    return { conferencePage }
})

// Extract about page and members from page data
const conferencePage: ComputedRef<DirectusConferencePage | undefined> = computed(() => pageData.value?.conferencePage)

// Set loading screen
useLoadingScreen(conferencePage)

// Set page meta data
usePageMeta(conferencePage)
</script>
