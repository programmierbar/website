<template>
  <div v-if="contactPage" class="relative">
    <div
      class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 pt-32 md:pt-40 lg:pt-56 2xl:pt-64 pb-2"
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Intro heading -->
      <SectionHeading class="mt-8 md:mt-0" element="h1">
        {{ contactPage.intro_heading }}
      </SectionHeading>

      <!-- Intro text -->
      <InnerHtml
        class="text-lg md:text-2xl lg:text-3xl text-white md:font-bold leading-normal md:leading-normal lg:leading-normal mt-8 md:mt-16"
        :html="contactPage.intro_text"
      />
    </div>

    <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 pt-2 pb-2">
      <p
        class="text-lg md:text-2xl lg:text-3xl text-white md:font-bold leading-normal md:leading-normal lg:leading-normal mt-8 md:mt-16"
      >
        Du kannst uns eine Sprachnachricht hinterlassen:
      </p>
      <iframe src="https://www.speakpipe.com/widget/inline/bvxj64wpxs38ecdhe2dq78zbabn2qjc4" allow="microphone" width="100%" height="200" frameborder="0"></iframe>
    </div>

    <!-- Contact form -->
    <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 pt-2 pb-2">
      <p
        class="text-lg md:text-2xl lg:text-3xl text-white md:font-bold leading-normal md:leading-normal lg:leading-normal mt-8 md:mt-16"
      >
        Oder uns eine Nachricht schreiben:
      </p>
      <ContactForm class="pt-2 pb-2" />
    </div>

    <div
      class="container px-6 md:pl-72 lg:pl-80 xl:pl-96 lg:pr-8 3xl:pl-52 my-16 md:my-24 lg:mt-32 lg:mb-40"
    >
      <!-- Detail text -->
      <InnerHtml
        class="text-base md:text-xl lg:text-2xl text-white font-light md:leading-normal lg:leading-normal space-y-8 break-words"
        :html="contactPage.detail_text"
      />

      <!-- Google Maps -->
      <a
        class="block text-base md:text-xl lg:text-2xl text-lime font-bold mt-8"
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
import { GOOGLE_MAPS_URL, OPEN_GOOGLE_MAPS_EVENT_ID } from '../config';

import { useLoadingScreen, usePageMeta } from '../composables';
import { trackGoal } from '../helpers';
import { directus } from '../services';
import { ContactPage } from '../types';

const breadcrumbs = [{ label: 'Kontakt' }];
const googleMapsUrl = GOOGLE_MAPS_URL;

// Query contact page
const { data: contactPage } = useAsyncData(
  () => directus.singleton('contact_page').read() as Promise<ContactPage>
);

// Set loading screen
useLoadingScreen(contactPage);

// Set page meta data
usePageMeta(contactPage);

useHead({
  script: [
    {
      src: 'https://www.speakpipe.com/widget/loader.js',
      async: true,
      tagPosition: 'bodyClose',
    }
  ],
});

</script>
