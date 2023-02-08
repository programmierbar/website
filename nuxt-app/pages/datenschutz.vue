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

<script lang="ts">
import { defineComponent, useMeta } from 'vue';
import { Breadcrumbs, InnerHtml, SectionHeading } from '../components';
import { useAsyncData, useLoadingScreen } from '../composables';
import { getMetaInfo } from '../helpers';
import { directus } from '../services';
import { PrivacyPage } from '../types';

export default defineComponent({
  components: {
    Breadcrumbs,
    InnerHtml,
    SectionHeading,
  },
  setup() {
    // Query privacy page
    const privacyPage = useAsyncData(
      () => directus.singleton('privacy_page').read() as Promise<PrivacyPage>
    );

    // Set loading screen
    useLoadingScreen(privacyPage);

    // Set page meta data
    useMeta(
      getMetaInfo({
        type: 'website',
        path: '/datenschutz',
        title: 'Datenschutz',
        noIndex: true,
      })
    );

    return {
      privacyPage,
      breadcrumbs: [{ label: 'Datenschutz' }],
    };
  },
  head: {},
});
</script>
