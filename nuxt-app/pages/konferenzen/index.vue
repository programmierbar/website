<template>
    <div v-if="conferencePage">
        <section class="relative">
            <PageCoverImage :cover-image="conferencePage.cover_image" v-if="conferencePage.cover_image" />
            <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />
               <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                    {{ conferencePage.conference_heading }}
                </SectionHeading>
                <InnerHtml
                  class="mt-8 text-5xl font-black leading-normal text-white"
                  :html="conferencePage.intro_heading"
                />
                <InnerHtml
                    class="mt-2 text-2xl font-light leading-normal text-white"
                    :html="conferencePage.intro_text_1"
                />
            </div>
        </section>
        <section class="relative">
          <ConferenceSection :heading='"Termine"' :conferences="conferences" />
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <InnerHtml
              class="mt-8 text-5xl font-black leading-normal text-white"
              :html="conferencePage.faqs_heading"
            />
            <InnerHtml
              class="mt-2 text-2xl font-light leading-normal text-white"
              :html="conferencePage.faqs_text_1"
            />
            <FaqList :faqs='conferencePage.faqs' />
          </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen, usePageMeta } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusConferenceItem, DirectusConferencePage } from '~/types';
import { computed, type ComputedRef } from 'vue'

const breadcrumbs = [{ label: 'Konferenzen' }]
const directus = useDirectus()

const { data: pageData } = useAsyncData(async () => {
    const [conferencePage, conferences] = await Promise.all([
      directus.getConferencePage(),
      directus.getConferences(),
    ])

    return { conferencePage, conferences }
})

const conferencePage: ComputedRef<DirectusConferencePage | undefined> = computed(() => pageData.value?.conferencePage)
const conferences: ComputedRef<DirectusConferenceItem[]> = computed(() => pageData.value?.conferences || [])

// Set loading screen
useLoadingScreen(conferencePage)

// Set page meta data
usePageMeta(conferencePage)
</script>
