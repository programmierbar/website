<template>
  <div v-if="meetupPage && meetups">
    <section class="relative">
      <!-- Page cover -->
      <PageCoverImage :cover-image="meetupPage.cover_image" />
      <div
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-16 md:mt-28 lg:mt-32"
      >
        <Breadcrumbs :breadcrumbs="breadcrumbs" />

        <!-- Page intro -->
        <SectionHeading
          class="md:pt-2/5-screen lg:pt-1/2-screen mt-8 md:mt-0"
          element="h1"
        >
          {{ meetupPage.intro_heading }}
        </SectionHeading>
        <MarkdownToHtml
          class="
            text-lg
            md:text-2xl
            lg:text-3xl
            text-white
            font-bold
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-16
          "
          :markdown="meetupPage.intro_text_1"
        />
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            md:font-normal
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-6
          "
          :markdown="meetupPage.intro_text_2"
        />

        <!-- Corona info -->
        <MarkdownToHtml
          class="
            text-sm
            md:text-lg
            lg:text-xl
            text-lime
            font-bold
            leading-relaxed
            md:leading-relaxed
            lg:leading-relaxed
            italic
            space-y-6
            mt-10
            md:mt-20
            lg::mt-32
          "
          :markdown="meetupPage.corona_text"
        />
      </div>
    </section>

    <!-- Meetups -->
    <section class="relative my-12 md:my-28 lg:my-40">
      <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
        <SectionHeading element="h2">
          {{ meetupPage.meetups_heading }}
        </SectionHeading>
        <LazyList class="mt-10" :items="meetups" direction="vertical">
          <template #default="{ item, index }">
            <li :key="item.id" :class="index > 0 && 'mt-14 md:mt-20 lg:mt-28'">
              <MeetupCard :meetup="item" />
            </li>
          </template>
        </LazyList>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  LazyList,
  MarkdownToHtml,
  MeetupCard,
  PageCoverImage,
  SectionHeading,
} from '../../components';
import { useStrapi, usePageMeta } from '../../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    LazyList,
    MarkdownToHtml,
    MeetupCard,
    PageCoverImage,
    SectionHeading,
  },
  setup() {
    // Query Strapi about page and members
    const meetupPage = useStrapi('meetup-page');
    const meetups = useStrapi('meetups', '?_limit=-1');

    // Set page meta data
    usePageMeta(meetupPage);

    return {
      meetupPage,
      meetups,
      breadcrumbs: [{ label: 'Meetup' }],
    };
  },
  head: {},
});
</script>
