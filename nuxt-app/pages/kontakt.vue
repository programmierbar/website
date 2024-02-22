<template>
    <div v-if="contactPage" class="relative">
        <div class="3xl:px-8 container px-6 pb-12 pt-32 md:pb-24 md:pl-48 md:pt-40 lg:pb-32 lg:pr-8 lg:pt-56 2xl:pt-64">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Intro heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ contactPage.intro_heading }}
            </SectionHeading>

            <!-- Intro text -->
            <InnerHtml
                class="mt-8 text-lg leading-normal text-white md:mt-16 md:text-2xl md:font-bold md:leading-normal lg:text-3xl lg:leading-normal"
                :html="contactPage.intro_text"
            />
        </div>

        <!-- Contact form -->
        <div class="3xl:px-8 container md:pl-48 md:pr-6 lg:pr-8">
            <ContactForm />
        </div>

        <div class="3xl:pl-52 container my-16 px-6 md:my-24 md:pl-72 lg:mb-40 lg:mt-32 lg:pl-80 lg:pr-8 xl:pl-96">
            <!-- Detail text -->
            <InnerHtml
                class="space-y-8 break-words text-base font-light text-white md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                :html="contactPage.detail_text"
            />

            <!-- Google Maps -->
            <a
                class="text-lime mt-8 block text-base font-bold md:text-xl lg:text-2xl"
                :href="googleMapsUrl"
                target="_blank"
                rel="noreferrer"
                data-cursor-hover
                @click="() => trackGoal(OPEN_GOOGLE_MAPS_EVENT_ID)"
            >
                Google Maps
            </a>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen, usePageMeta } from '../composables'
import { GOOGLE_MAPS_URL, OPEN_GOOGLE_MAPS_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'
import { directus } from '../services'
import type { ContactPage } from '../types'

const breadcrumbs = [{ label: 'Kontakt' }]
const googleMapsUrl = GOOGLE_MAPS_URL

// Query contact page
const { data: contactPage } = useAsyncData(() => directus.singleton('contact_page').read() as Promise<ContactPage>)

// Set loading screen
useLoadingScreen(contactPage)

// Set page meta data
usePageMeta(contactPage)
</script>
