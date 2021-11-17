<template>
  <div v-if="meetup">
    <article class="relative">
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
        "
      >
        <div class="flex items-center justify-between space-x-4">
          <Breadcrumbs :breadcrumbs="breadcrumbs" />
          <!-- <LikeButton /> -->
        </div>

        <h1
          class="
            text-2xl
            md:text-4xl
            lg:text-5xl
            text-white
            font-black
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-12
            md:mt-16
            lg:mt-20
          "
        >
          {{ meetup.title }}
        </h1>

        <div class="xl:flex xl:items-end xl:space-x-12">
          <!-- Cover and YouTube -->
          <a
            v-if="meetup.youtube_url"
            class="
              xl:w-2/3
              relative
              flex
              items-center
              justify-center
              mt-10
              md:mt-12
              lg:mt-16
            "
            :href="meetup.youtube_url"
            target="_blank"
            rel="noreferrer"
            data-cursor-hover
          >
            <div
              class="
                h-16
                xs:h-20
                md:h-24
                lg:h-36
                absolute
                z-10
                text-blue
                pointer-events-none
              "
              v-html="require('../../assets/icons/play-circle.svg?raw')"
            />
            <MeetupCover class="w-full" :meetup="meetup" />
          </a>
          <MeetupCover
            v-else
            class="xl:w-2/3 mt-10 md:mt-12 lg:mt-16"
            :meetup="meetup"
          />

          <!-- Meetup, calendar & maps -->
          <MeetupCalendarAndMaps
            class="xl:w-1/4 hidden xl:flex"
            :meetup="meetup"
          />
        </div>

        <!-- Start and end time -->
        <MeetupStartAndEnd
          class="
            text-sm
            md:text-lg
            lg:text-xl
            text-lime
            font-bold
            italic
            mt-10
            md:mt-16
            lg:mt-24
          "
          :meetup="meetup"
        />

        <!-- Heading and description -->
        <SectionHeading class="hidden md:block" element="h2">
          Meetup Infos
        </SectionHeading>
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            leading-normal
            space-y-8
            mt-8
            md:mt-14
          "
          :markdown="meetup.description"
        />

        <!-- Meetup tags -->
        <!-- TODO: Replace router.push() with <a> element -->
        <TagList
          v-if="meetup.tags.length"
          class="mt-10 md:mt-14"
          :tags="meetup.tags"
          :on-click="
            (tag) =>
              router.push({
                path: '/suche',
                query: { search: tag.name },
              })
          "
        />

        <!-- Meetup, calendar & maps -->
        <MeetupCalendarAndMaps
          class="xl:hidden mt-16 md:mt-20"
          :meetup="meetup"
        />
      </div>
    </article>

    <!-- Speakers -->
    <section v-if="meetup.speakers.length" class="relative">
      <div
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-20 md:mt-32 lg:mt-40"
      >
        <SectionHeading element="h2">Speaker Info</SectionHeading>
        <SpeakerList class="mt-12 md:mt-0" :speakers="meetup.speakers" />
        <div
          v-if="speakerCountString"
          class="flex justify-center mt-12 md:mt-20 lg:mt-28"
        >
          <LinkButton href="/hall-of-fame">
            Alle {{ speakerCountString }} Speaker:innen
          </LinkButton>
        </div>
      </div>
    </section>

    <!-- Related podcasts -->
    <section
      v-if="relatedPodcasts && relatedPodcasts.length"
      class="relative md:pl-40 3xl:px-0 mt-20 md:mt-32 lg:mt-40"
    >
      <SectionHeading class="px-6 md:px-0" element="h2">
        Verwandte Podcasts
      </SectionHeading>
      <PodcastSlider class="mt-12 md:mt-0" :podcasts="relatedPodcasts" />
    </section>

    <FeedbackSection
      class="md:pl-40 3xl:px-0 mt-16 md:mt-24 lg:mt-32 mb-20 md:mb-32 lg:mb-40"
    />
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  useMeta,
  useRoute,
  useRouter,
} from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  FeedbackSection,
  // LikeButton,
  LinkButton,
  MarkdownToHtml,
  MeetupCalendarAndMaps,
  MeetupCover,
  MeetupStartAndEnd,
  PodcastSlider,
  SectionHeading,
  SpeakerList,
  TagList,
} from '../../components';
import { useStrapi, useLocaleString } from '../../composables';
import { getTrimmedString } from '../../helpers';

export default defineComponent({
  components: {
    Breadcrumbs,
    FeedbackSection,
    // LikeButton,
    LinkButton,
    MarkdownToHtml,
    MeetupCalendarAndMaps,
    MeetupCover,
    MeetupStartAndEnd,
    PodcastSlider,
    SectionHeading,
    SpeakerList,
    TagList,
  },
  setup() {
    // Add router
    const router = useRouter();

    // Get route and meetup ID param
    const route = useRoute();
    const meetupIdPath = computed(
      () => `/${route.value.params.slug.split('-').pop()}` as const
    );

    // Query Strapi meetup
    const meetup = useStrapi('meetups', meetupIdPath);

    // Query Strapi speaker count and convert it to local string
    const speakerCount = useStrapi('speakers', '/count');
    const speakerCountString = useLocaleString(speakerCount);

    // Set page meta data
    useMeta(() =>
      meetup.value
        ? {
            title: `${meetup.value.title} | programmier.bar`,
            meta: [
              {
                hid: 'description',
                name: 'description',
                content: getTrimmedString(meetup.value.description, 160),
              },
            ],
          }
        : {}
    );

    // Create breadcrumb list
    const breadcrumbs = computed(() => [
      { label: 'Meetup', href: '/meetup' },
      {
        label: meetup.value
          ? getTrimmedString(meetup.value.title, 12)
          : 'Error 404',
      },
    ]);

    // Create related podcasts query string
    const relatedPodcastsQuery = computed(() =>
      meetup.value && meetup.value.tags.length
        ? (`?${meetup.value.tags
            .map((tag, index) => `_where[_or][${index}][0][tags_in]=${tag.id}`)
            .join('&')}&_sort=published_at:DESC` as const)
        : ('?_limit=0' as const)
    );

    // Query related podcast from Strapi
    const relatedPodcasts = useStrapi('podcasts', relatedPodcastsQuery);

    return {
      router,
      meetup,
      speakerCountString,
      breadcrumbs,
      relatedPodcasts,
    };
  },
  head: {},
});
</script>
