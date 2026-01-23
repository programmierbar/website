<template>
    <div v-if="conferencePage">
        <section class="relative">
            <PageCoverImage v-if='!conferencePage.video && conferencePage.cover_image' :cover-image="conferencePage.cover_image"/>
            <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />
               <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                    {{ conferencePage.conference_heading }}
                </SectionHeading>
                <InnerHtml
                  class="mt-8 text-3xl md:text-5xl font-black leading-normal text-white"
                  :html="conferencePage.intro_heading"
                />
            </div>
        </section>

      <section v-if='conferencePage.video' class='mt-16 md:mt-28 lg:mt-32'>
        <ScrollDownMouse />
        <div class="bg-gray-900">
          <video
            class="min-h-80 w-full object-cover"
            :src="videoUrl || ''"
            :alt="conferencePage.video.title || ''"
            autoplay
            loop
            muted
            playsinline
          />
        </div>
      </section>

      <section class="relative">
        <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
          <InnerHtml
            class="mt-2 text-2xl font-light leading-normal text-white"
            :html="conferencePage.intro_text_1"
          />
        </div>
      </section>

      <section class="relative">
          <ConferenceSection :heading='"Termine"' :conferences="conferences" />
        </section>

      <section class="relative">
        <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8 md:mb-16 lg:mb-48">
          <SectionHeading element="h2">
            Community
          </SectionHeading>
          <TestimonialSlider :testimonials='testimonials' />
        </div>
      </section>

      <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <InnerHtml
              class="mt-8 text-3xl font-black leading-normal text-white"
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
import type { DirectusConferenceItem, DirectusConferencePage, DirectusTestimonialItem } from '~/types';
import { computed, type ComputedRef } from 'vue'
import TestimonialSlider from '~/components/TestimonialSlider.vue';
import { DIRECTUS_CMS_URL } from '../../config'

const breadcrumbs = [{ label: 'Konferenzen' }]
const directus = useDirectus()

const { data: pageData } = useAsyncData(async () => {
    const [conferencePage, conferences, testimonials] = await Promise.all([
      directus.getConferencePage(),
      directus.getConferences(),
      directus.getTestimonials(),
    ])

    return { conferencePage, conferences, testimonials }
})

const conferencePage: ComputedRef<DirectusConferencePage | undefined> = computed(() => pageData.value?.conferencePage)
const conferences: ComputedRef<DirectusConferenceItem[]> = computed(() => pageData.value?.conferences || [])
const testimonials: ComputedRef<DirectusTestimonialItem[]> = computed(() => pageData.value?.testimonials || [])

// Create Video URL
const videoUrl = computed(() => pageData.value && `${DIRECTUS_CMS_URL}/assets/${pageData.value?.conferencePage.video?.id}`)

// Set loading screen
useLoadingScreen(conferencePage)

// Set page meta data
usePageMeta(conferencePage)
</script>
