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

        <section v-if='showTicketSection' class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
              Tickets
            </SectionHeading>
              <BackgroundSpotlights :position='"-top-32 fixed right-[-40vw] -translate-x-1/2 transform"' :index='"0"' />
              <InnerHtml
                class="mt-2 text-2xl font-light leading-normal z-30 relative"
                :html="conference.tickets_text"
              />

            <!-- Ticket price cards -->
            <div v-if="conference.ticket_regular_price_cents" class="relative z-30 mt-12 grid gap-6 sm:grid-cols-2 lg:max-w-2xl">
              <!-- Early Bird -->
              <div
                v-if="conference.ticket_early_bird_price_cents"
                class="group relative overflow-hidden rounded-2xl border-2 border-lime bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.4),_rgba(168,85,247,0.3)_35%,_rgba(207,255,0,0.12)_70%,_transparent)] p-6 transition-all hover:border-lime hover:shadow-[0_0_30px_rgba(207,255,0,0.15)]"
              >
                <div class="mb-1 text-xs font-bold uppercase tracking-widest text-lime">Early Bird</div>
                <div v-if="isEarlyBird" class="mb-1 inline-block rounded-full bg-lime/20 px-2 py-0.5 text-xs font-medium text-lime">
                  Jetzt verfügbar – bis {{ formatDeadline(conference.ticket_early_bird_deadline) }}
                </div>
                <div class="mt-2 flex items-baseline gap-1">
                  <span class="text-5xl font-black text-white">{{ formatCentsShort(conference.ticket_early_bird_price_cents ?? 0) }}</span>
                  <span class="text-lg text-gray-400">€</span>
                </div>
                <div class="mt-1 text-sm text-gray-400">
                  {{ formatCentsGross(conference.ticket_early_bird_price_cents ?? 0) }} inkl. MwSt.
                </div>
              </div>

              <!-- Regular -->
              <div
                class="group relative overflow-hidden rounded-2xl border border-gray-500 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(99,102,241,0.35),_rgba(168,85,247,0.2)_45%,_transparent)] p-6 transition-all hover:border-gray-400"
              >
                <div class="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Regulär</div>
                <div v-if="!isEarlyBird" class="mb-1 inline-block rounded-full bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
                  Aktueller Preis
                </div>
                <div class="mt-2 flex items-baseline gap-1">
                  <span class="text-5xl font-black text-white">{{ formatCentsShort(conference.ticket_regular_price_cents ?? 0) }}</span>
                  <span class="text-lg text-gray-400">€</span>
                </div>
                <div class="mt-1 text-sm text-gray-400">
                  {{ formatCentsGross(conference.ticket_regular_price_cents ?? 0) }} inkl. MwSt.
                </div>
              </div>
            </div>

            <!-- CTA Button -->
            <div class="relative z-30 mt-10">
              <NuxtLink
                :to="`/konferenzen/${conference.slug}/tickets`"
                data-cursor-hover
                class="inline-flex items-center gap-4 rounded-full bg-lime px-10 py-4 font-bold uppercase text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(207,255,0,0.3)]"
              >
                <span class="text-xl md:text-2xl">Tickets kaufen</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </section>

        <section v-if='showTicketSection' class="relative">
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

        <section v-if='!showTicketSection' class="relative">
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

        <section v-if='conference.partnersPrepared.length > 0' class="relative">
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
import type { ConferenceItem, DirectusConferencePage, DirectusTestimonialItem, DirectusFileItem, TalkItem } from '~/types';
import { computed, type ComputedRef } from 'vue'
import ConferenceSpeakersSlider from '~/components/ConferenceSpeakersSlider.vue';
import ConferenceGallery from '~/components/ConferenceGallery.vue';
import TestimonialSlider from '~/components/TestimonialSlider.vue';
import { getAssetUrl } from '~/helpers/getAssetUrl';
import { VAT_RATE } from '~/config';

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

const isEarlyBird = computed(() => {
    if (!conference.value?.ticket_early_bird_deadline) return false
    return new Date() <= new Date(conference.value.ticket_early_bird_deadline)
})

function formatCentsShort(netCents: number): string {
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(netCents / 100)
}

function formatDeadline(deadline: string | null): string {
    if (!deadline) return ''
    return new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCentsGross(netCents: number): string {
    const grossCents = Math.round(netCents * (1 + VAT_RATE))
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(grossCents / 100)
}

const isConferenceOver = computed(() => {
    if (!conference.value?.end_on) return false
    const endDate = new Date(conference.value.end_on)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return endDate < today
})

const showTicketSection = computed(() => {
    return conference.value?.ticketing_enabled === true && !isConferenceOver.value
})

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
  const agenda = conference.value?.agenda.map((talk) => {

    const currentTalk: preparedAgendaItem = {
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

const videoUrl = computed(() => getAssetUrl(pageData.value?.conference?.video))

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
