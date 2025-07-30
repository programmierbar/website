<template>
    <div v-if="conference && conferencePage" class='text-white'>
      <article class="relative">
        <section class="relative">
          <PageCoverImage :cover-image="conference.cover_image" v-if="conference.cover_image" />
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h1">
              {{ conference.title }}
            </SectionHeading>
            <InnerHtml
              class="mt-2 text-2xl font-light leading-normal z-30 relative"
              :html="conference.text_1"
            />
          </div>
        </section>

        <section class="relative" v-if='conference.tickets_on_sale'>
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Tickets
            </SectionHeading>
              <BackgroundSpotlights :position='"-top-32 fixed right-[-40vw] -translate-x-1/2 transform"' :index='"0"' />
              <InnerHtml
                class="mt-2 text-2xl font-light leading-normal z-30 relative"
                :html="conference.tickets_text"
              />
            <ConferenceTickets :tickets='conference.tickets' :ticketsOnSale='conference.tickets_on_sale' :ticketsUrl='conference.tickets_url' />

            <div class='flex flex-row flex-wrap space justify-around mt-8' v-if='conference.tickets_url'>
              <a :href='conference.tickets_url'
                 target='_blank'
                 data-cursor-hover
                class="m-auto rounded-full border-4 border-lime text-sm text-lime px-8 py-4 text-left"
                type="submit"
              >
                <div class='flex flex-row'>
                  <div>
                    <span class='uppercase font-bold text-xl md:text-4xl'>Zu den Tickets</span>
                    <br /><span class='text-xl md:text-3xl'>via Wix.com</span>
                  </div>
                  <div class='pl-4 md:pl-12'>
                    <svg xmlns="http://www.w3.org/2000/svg" width="65" height="66" viewBox="0 0 65 66" fill="none">
                      <path d="M14.5378 17.334L47.7277 17.334L47.7291 50.9206" stroke="#CFFF00" stroke-width="5.34" stroke-linecap="round"/>
                      <path d="M14.8991 46.5993C13.8564 47.642 13.8564 49.3326 14.8991 50.3753C15.9418 51.418 17.6324 51.418 18.6751 50.3753L14.8991 46.5993ZM47.6378 17.6366L45.7498 15.7486L14.8991 46.5993L16.7871 48.4873L18.6751 50.3753L49.5258 19.5246L47.6378 17.6366Z" fill="#CFFF00"/>
                    </svg>
                  </div>
                </div>

              </a>
            </div>
          </div>
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Speaker
            </SectionHeading>
            <BackgroundSpotlights :position='"-top-96 -left-96"' :index='"0"' />
            <ConferenceSpeakersSlider :speakers='conference.speakersPrepared' />
          </div>
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Agenda
            </SectionHeading>
            <ConferenceAgenda :agenda='conference.agenda' />
          </div>
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Talks
            </SectionHeading>
            <div v-for="(talk, index) of conference.talksPrepared" :key="talk.id" class='mb-36 relative'>
              <BackgroundSpotlights v-if='index % 2 == 0' :position='"-top-96 fixed right-[-40vw] -translate-x-1/2 transform"' :index='"-10"' />
              <BackgroundSpotlights v-if='index % 2 != 0' :position='"-top-96 fixed left-[-12vw] -translate-x-1/2 transform"' :index='"-10"' />
              <TalkItem :talk='talk' />
            </div>
          </div>
        </section>

        <section class="relative my-16">
          <ConferenceGallery :images='galleryImages' />
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
            <FaqList :faqs='combinedFaqs' />
          </div>
        </section>

        <section class="relative">
          <div class="container my-16 px-6 md:my-28 md:pl-48 lg:my-32 lg:pr-8 3xl:px-8">
            <p class="text-base font-light leading-normal text-white md:mt-14 md:text-xl lg:text-2xl">
              Bitte beachte auch unsere
              <NuxtLink class="text-lime font-bold hover:underline" data-cursor-hover :to="'/verhaltensregeln'">
                Verhaltensregeln
              </NuxtLink>
              und den
              <NuxtLink class="text-lime font-bold hover:underline" data-cursor-hover :to="'/aufnahmen'">
                Hinweis zu Foto- und Videoaufnahmen.
              </NuxtLink>
            </p>
          </div>
        </section>
      </article>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo, trackGoal } from '~/helpers';
import type { ConferenceItem, DirectusConferencePage, TagItem } from '~/types';
import { computed, type ComputedRef } from 'vue'
import ConferenceSpeakersSlider from '~/components/ConferenceSpeakersSlider.vue';
import ConferenceGallery from '~/components/ConferenceGallery.vue';
import type { DirectusFile } from '@directus/sdk';
import ConferenceTickets from '~/components/ConferenceTickets.vue';
import TalkItem from '~/components/TalkItem.vue';

// Add route and router
const route = useRoute()

const directus = useDirectus()

// Query conference and page
const { data: pageData } = useAsyncData(route.fullPath, async () => {
    // Query conference and page async
    const [conference, conferencePage] = await Promise.all([
        await directus.getConferenceBySlug(route.params.slug as string),
        await directus.getConferencePage(),
    ])

    // Throw error if meetup does not exist
    if (!conference) {
        throw new Error('The conference was not found.')
    }

    // Throw error if meetup does not exist
    if (!conferencePage) {
      throw new Error('Could not access conference page.')
    }

    // Return conference and page
    return { conference, conferencePage }
})

// Extract conference and page from page data
const conference: ComputedRef<ConferenceItem | undefined> = computed(() => pageData.value?.conference)
const conferencePage: ComputedRef<DirectusConferencePage | undefined> = computed(() => pageData.value?.conferencePage)

const combinedFaqs: ComputedRef<[]> = computed(() => {
  let faqs = [];
  if (pageData.value?.conference?.faqs) {
    faqs = [...pageData.value.conference.faqs];
  }
  if (pageData.value?.conferencePage?.faqs) {
    faqs = [...faqs, ...pageData.value.conferencePage.faqs];
  }
  return faqs;
})

const galleryImages: ComputedRef<DirectusFile[]> = computed(() => {
  let images = [];

  if (pageData.value?.conference?.gallery_images) {
    images = pageData.value.conference.gallery_images.map((gallery_image) => {
      return gallery_image.directus_files_id;
    })
  }

  return images;
})

// Set loading screen
useLoadingScreen(conference, conferencePage)

// Set page meta data
useHead(() =>
  conference.value
        ? getMetaInfo({
              type: 'article',
              path: route.path,
              title: conference.value.title,
              description: conference.value.text_1,
              image: conference.value.cover_image,
              publishedAt: conference.value.published_on.split('T')[0],
          })
        : {}
)

// Create breadcrumb list
const breadcrumbs = computed(() => [{ label: 'Konferenz', href: '/konferenzen' }, { label: conference.value?.title || '' }])
</script>
