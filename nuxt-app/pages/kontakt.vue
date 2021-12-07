<template>
  <div v-if="contactPage">
    <section class="relative">
      <div
        class="
          container
          px-6
          md:pl-48
          lg:pr-8
          3xl:px-8
          pt-32
          md:pt-40
          lg:pt-56
          2xl:pt-64
          pb-12
          md:pb-24
          lg:pb-32
        "
      >
        <Breadcrumbs :breadcrumbs="breadcrumbs" />

        <!-- Business heading -->
        <SectionHeading class="mt-8 md:mt-0" element="h1">
          {{ contactPage.business_heading }}
        </SectionHeading>

        <!-- Page intro -->
        <MarkdownToHtml
          class="
            text-lg
            md:text-2xl
            lg:text-3xl
            text-white
            md:font-bold
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-16
          "
          :markdown="contactPage.intro_text"
        />
      </div>

      <!-- Contact form -->
      <div class="container md:pr-6 md:pl-48 lg:pr-8 3xl:px-8">
        <ContactForm />
      </div>

      <div
        class="
          container
          px-6
          md:pl-72
          lg:pl-80
          xl:pl-96
          lg:pr-8
          3xl:pl-52
          mt-16
          md:mt-24
          lg:mt-32
        "
      >
        <!-- Address text -->
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            md:leading-normal
            lg:leading-normal
            space-y-8
            break-words
          "
          :markdown="contactPage.business_text"
        />
      </div>
    </section>

    <section class="relative">
      <div
        class="
          container
          px-6
          md:pl-72
          lg:pl-80
          xl:pl-96
          lg:pr-8
          3xl:pl-52
          mt-12
          md:mt-16
          lg:mt-24
          mb-16
          md:mb-24
          lg:mb-40
        "
      >
        <!-- Address heading -->
        <!-- <SectionHeading element="h2">
          {{ contactPage.address_heading }}
        </SectionHeading> -->

        <!-- Business text -->
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            md:leading-normal
            lg:leading-normal
            space-y-8
            break-words
            mt-8
          "
          :markdown="contactPage.address_text"
        />

        <!-- Google Maps -->
        <a
          class="
            block
            text-base
            md:text-xl
            lg:text-2xl
            text-lime
            font-bold
            mt-8
          "
          :href="googleMapsUrl"
          target="_blank"
          rel="noreferrer"
          data-cursor-hover
          @click="() => trackGoal(OPEN_GOOGLE_MAPS_EVENT_ID)"
        >
          Google Maps
        </a>
      </div>

      <!-- Google Maps -->
      <!-- <div
        class="
          md:container md:pr-6 md:pl-48
          lg:pr-8
          3xl:px-8
          mt-10
          md:mt-16
          lg:mt-32
          md:pb-36
          lg:pb-52
        "
      >
        <GoogleMaps class="h-120 lg:h-160 2xl:h-192" />
      </div> -->
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import { GOOGLE_MAPS_URL, OPEN_GOOGLE_MAPS_EVENT_ID } from '../config';
import {
  Breadcrumbs,
  ContactForm,
  // GoogleMaps,
  MarkdownToHtml,
  SectionHeading,
} from '../components';
import { useStrapi, useLoadingScreen, usePageMeta } from '../composables';
import { trackGoal } from '../helpers';

export default defineComponent({
  components: {
    Breadcrumbs,
    ContactForm,
    // GoogleMaps,
    MarkdownToHtml,
    SectionHeading,
  },
  setup() {
    // Query Strapi contact-page
    const contactPage = useStrapi('contact-page');

    // Set loading screen
    useLoadingScreen(contactPage);

    // Set page meta data
    usePageMeta(contactPage);

    return {
      contactPage,
      breadcrumbs: [{ label: 'Kontakt' }],
      googleMapsUrl: GOOGLE_MAPS_URL,
      OPEN_GOOGLE_MAPS_EVENT_ID,
      trackGoal,
    };
  },
  head: {},
});
</script>
