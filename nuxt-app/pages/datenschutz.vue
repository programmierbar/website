<template>
  <div v-if="privacyPage" class="relative">
    <div
      class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 pt-32 md:pt-40 lg:pt-56 2xl:pt-64 pb-20 md:pb-32 lg:pb-52"
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Heading -->
      <SectionHeading class="mt-8 md:mt-0" element="h1">
        {{ privacyPage.heading }}
      </SectionHeading>

      <!-- Text -->
      <InnerHtml
        class="text-base md:text-xl lg:text-2xl text-white font-light md:leading-normal lg:leading-normal space-y-8 break-words mt-8 md:mt-16"
        :html="privacyPage.text"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '../composables';
import { getMetaInfo } from '../helpers';
import { directus } from '../services';
import type { PrivacyPage } from '../types';

const breadcrumbs = [{ label: 'Datenschutz' }];
// Query privacy page
const { data: privacyPage } = useAsyncData(
  () => directus.singleton('privacy_page').read() as Promise<PrivacyPage>
);

// Set loading screen
useLoadingScreen(privacyPage);

// Set page meta data
useHead(
  getMetaInfo({
    type: 'website',
    path: '/datenschutz',
    title: 'Datenschutz',
    noIndex: true,
  })
);
</script>
