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
        <InnerHtml
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
          :html="meetupPage.intro_text_1"
        />
        <InnerHtml
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
          :html="meetupPage.intro_text_2"
        />

        <!-- Corona info -->
        <InnerHtml
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
          :html="meetupPage.corona_text"
        />
      </div>
    </section>

    <!-- Meetups -->
    <section class="relative mt-12 md:mt-28 lg:mt-40 mb-14 md:mb-32 lg:mb-52">
      <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
        <SectionHeading element="h2">
          {{ meetupPage.meetup_heading }}
        </SectionHeading>
        <LazyList class="mt-10" :items="meetups" direction="vertical">
          <template #default="{ item, index, viewportItems, addViewportItem }">
            <LazyListItem
              :key="item.id"
              :class="index > 0 && 'mt-14 md:mt-20 lg:mt-28'"
              :item="item"
              :viewport-items="viewportItems"
              :add-viewport-item="addViewportItem"
            >
              <template #default="{ isNewToViewport }">
                <FadeAnimation
                  :fade-in="isNewToViewport ? 'from_right' : 'none'"
                >
                  <MeetupCard :meetup="item" />
                </FadeAnimation>
              </template>
            </LazyListItem>
          </template>
        </LazyList>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLoadingScreen, usePageMeta } from '~/composables';
import { directus } from '~/services';
import { MeetupPage, MeetupItem } from '~/types';
import LazyList from '~/components/LazyList.vue';
import LazyListItem from '~/components/LazyListItem.vue';

const breadcrumbs = [{ label: 'Meetup' }];

// Query meetup page and meetups
const { data: pageData } = useAsyncData(async () => {
  const [meetupPage, meetups] = await Promise.all([
    // Meetup page
    directus
      .singleton('meetup_page')
      .read({ fields: '*.*' }) as Promise<MeetupPage>,

    // Meetups
    (
      await directus.items('meetups').readByQuery({
        fields: [
          'id',
          'slug',
          'start_on',
          'end_on',
          'title',
          'description',
          'cover_image.*',
        ],
        sort: ['-start_on'],
        limit: -1,
      })
    ).data as Pick<
      MeetupItem,
      'id' | 'start_on' | 'end_on' | 'title' | 'description' | 'cover_image'
    >[],
  ]);
  return { meetupPage, meetups };
});

// Extract about page and members from page data
const meetupPage = computed(() => pageData.value?.meetupPage);
const meetups = computed(() => pageData.value?.meetups);

// Set loading screen
useLoadingScreen(meetupPage, meetups);

// Set page meta data
usePageMeta(meetupPage);
</script>
