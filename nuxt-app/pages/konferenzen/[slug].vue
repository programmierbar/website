<template>
    <div v-if="conference && conferencePage" class='text-white'>
      <article class="relative">

        <section class="relative">
          <PageCoverImage v-if='!conference.video && conference.cover_image' :cover-image="conference.cover_image" :overlay="false" />
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />
            <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
              {{ conference.title }}
            </SectionHeading>
            <InnerHtml
              class="mt-8 text-3xl md:text-5xl font-black leading-normal text-white"
              :html="conference.headline_1"
            />
          </div>
        </section>

        <section v-if='conference.video' class='mt-16 md:mt-28 lg:mt-32'>
          <ScrollDownMouse />
          <div class="bg-gray-900">
            <video
              class="min-h-80 w-full object-cover"
              :src="videoUrl || ''"
              :aria-label="conference.video.title || ''"
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

        <section class="relative" v-if='conference.tickets_on_sale'>
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8 md:mb-16 lg:mb-48">
            <SectionHeading element="h2">
              Community
            </SectionHeading>
            <TestimonialSlider :testimonials='testimonials' />
          </div>
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2" class="mb-4">
              Speaker
            </SectionHeading>
            <BackgroundSpotlights :position='"-top-96 -left-96"' :index='"0"' />
            <ConferenceSpeakersSlider :speakers='conference.speakersPrepared' />
          </div>
        </section>

        <section class="relative my-16">
          <ConferenceGallery :images='galleryImages' />
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Agenda
            </SectionHeading>
            <ConferenceAgenda :agenda='preparedAgenda' />
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

        <section class="relative" v-if='!conference.tickets_on_sale'>
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
            <FaqList :faqs='combinedFaqs' />
          </div>
        </section>

        <section class="relative" v-if='conference.partnersPrepared.length > 0'>
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Partner
            </SectionHeading>
            <p class="text-base font-light leading-normal text-white md:mt-14 md:text-xl lg:text-2xl">
              Dieses Event wird durch folgende Partner unterstützt:
            </p>
            <div class="mt-8 flex flex-wrap gap-16 justify-center items-center sm:justify-start sm:items-start">
              <a
                v-for="partner in conference.partnersPrepared"
                :key="partner.id"
                :href="partner.url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-center w-40 h-18 hover:scale-105 transition-all duration-200"
                data-cursor-hover
              >
                <DirectusImage
                  v-if="partner.image"
                  :image="partner.image"
                  :alt="partner.name"
                  sizes="(max-width: 768px) 256px, (max-width: 1024px) 320px, 384px"
                  class="w-full h-auto object-contain"
                />
              </a>
            </div>
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
import type { ConferenceItem, DirectusConferencePage, DirectusTestimonialItem } from '~/types';
import { computed, type ComputedRef } from 'vue'
import ConferenceSpeakersSlider from '~/components/ConferenceSpeakersSlider.vue';
import ConferenceGallery from '~/components/ConferenceGallery.vue';
import ConferenceTickets from '~/components/ConferenceTickets.vue';
import TestimonialSlider from '~/components/TestimonialSlider.vue';
import type { TalkItem, DirectusFileItem } from '~/types';
import { getAssetUrl } from '~/helpers/getAssetUrl';

// Add route and router
const route = useRoute()

const directus = useDirectus()

// Query conference and page
const { data: pageData } = useAsyncData(route.fullPath, async () => {
    // Query conference and page async
    const [conference, conferencePage, testimonials] = await Promise.all([
        directus.getConferenceBySlug(route.params.slug as string),
        directus.getConferencePage(),
        directus.getTestimonials(),
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
    return { conference, conferencePage, testimonials }
})

// Extract conference and page from page data
const conference: ComputedRef<ConferenceItem | undefined> = computed(() => pageData.value?.conference)
const conferencePage: ComputedRef<DirectusConferencePage | undefined> = computed(() => pageData.value?.conferencePage)
const testimonials: ComputedRef<DirectusTestimonialItem[]> = computed(() => pageData.value?.testimonials || [])

type preparedAgendaItem = {
  start: string
  end: string
  title: string
  subtitle: string
  track: string
  talk_identifier: string
  _object: undefined | TalkItem
};

const preparedAgenda: ComputedRef<preparedAgendaItem[]> = computed(() => {
  let agenda = conference.value?.agenda.map((talk) => {

    let currentTalk: preparedAgendaItem = {
      _object: undefined,
      ...talk,
    }

    if (talk.talk_identifier) {
      const preparedTalk = conference.value?.talksPrepared.find(t => t.id === talk.talk_identifier);
      if (preparedTalk) {
        currentTalk._object = preparedTalk;
      }
    }

    return currentTalk;
  });

  if (!agenda) {
    return [];
  }

  return agenda;
})

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

const galleryImages: ComputedRef<DirectusFileItem []> = computed(() => {
  let images: DirectusFileItem[] = [];

  if (pageData.value?.conference?.gallery_images) {
    images = pageData.value.conference.gallery_images.map((gallery_image) => {
      return gallery_image.directus_files_id;
    })
  }

  return images;
})

const videoUrl = computed(() => pageData.value?.conference?.video && `${getAssetUrl(pageData.value?.conference?.video)}`)

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
