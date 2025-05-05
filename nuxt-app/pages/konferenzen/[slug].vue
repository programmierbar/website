<template>
    <div v-if="conference && conferencePage" class='text-white'>
      <article class="relative">
        <section class="relative">
          <PageCoverImage :cover-image="conference.cover_image" v-if="conference.cover_image" />
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
              {{ conference.title }}
            </SectionHeading>
            <InnerHtml
              class="mt-2 text-2xl font-light leading-normal text-white"
              :html="conference.text_1"
            />
          </div>
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h2">
              Speaker
            </SectionHeading>
            <ConferenceSpeakersSlider :speakers='conference.speakersPrepared' />
          </div>
        </section>

        <section class="relative">
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <InnerHtml
              class="mt-8 text-5xl font-black leading-normal text-white"
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
          <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
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

const combinedFaqs: ComputedRef<any | undefined> = computed(() => {
  let faqs = [];
  if (pageData.value?.conference?.faqs) {
    faqs = [...pageData.value.conference.faqs];
  }
  if (pageData.value?.conferencePage?.faqs) {
    faqs = [...faqs, ...pageData.value.conferencePage.faqs];
  }
  return faqs;
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
