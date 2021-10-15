<template>
  <div v-if="privacyPage" class="relative">
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
        pb-20
        md:pb-32
        lg:pb-52
      "
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Heading -->
      <SectionHeading class="mt-8 md:mt-0" element="h1"
        >Datenschutz</SectionHeading
      >

      <!-- Text -->
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
          md:mt-16
        "
        :markdown="privacyPage.text"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, useMeta } from '@nuxtjs/composition-api';
import { Breadcrumbs, MarkdownToHtml, SectionHeading } from '../components';
import { useStrapi } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    MarkdownToHtml,
    SectionHeading,
  },
  setup() {
    // Query Strapi privacy-page
    const privacyPage = useStrapi('privacy-page');

    // Set page meta data
    useMeta({
      title: 'Datenschutz | programmier.bar',
      meta: [
        { hid: 'description', name: 'description', content: '' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    });

    return {
      privacyPage,
      breadcrumbs: [{ label: 'Datenschutz' }],
    };
  },
  head: {},
});
</script>
