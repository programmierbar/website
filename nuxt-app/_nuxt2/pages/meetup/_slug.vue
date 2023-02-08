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
            @click="() => trackGoal(OPEN_YOUTUBE_EVENT_ID)"
          >
            <div
              class="
                h-20
                xs:h-24
                md:h-28
                lg:h-40
                absolute
                z-10
                text-blue text-opacity-90
                pointer-events-none
              "
              v-html="require('../../assets/icons/play-circle-filled.svg?raw')"
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
        <InnerHtml
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
          :html="meetup.description"
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
      class="relative mt-20 md:mt-32 lg:mt-40"
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
import { OPEN_YOUTUBE_EVENT_ID } from '../../config';
import {
  Breadcrumbs,
  InnerHtml,
  FeedbackSection,
  // LikeButton,
  LinkButton,
  MeetupCalendarAndMaps,
  MeetupCover,
  MeetupStartAndEnd,
  PodcastSlider,
  SectionHeading,
  SpeakerList,
  TagList,
} from '../../components';
import {
  useAsyncData,
  useLoadingScreen,
  useLocaleString,
} from '../../composables';
import { getMetaInfo, trackGoal } from '../../helpers';
import { directus } from '../../services';
import { MeetupItem, SpeakerItem, TagItem, PodcastItem } from '../../types';

export default defineComponent({
  components: {
    Breadcrumbs,
    InnerHtml,
    FeedbackSection,
    // LikeButton,
    LinkButton,
    MeetupCalendarAndMaps,
    MeetupCover,
    MeetupStartAndEnd,
    PodcastSlider,
    SectionHeading,
    SpeakerList,
    TagList,
  },
  setup() {
    // Add route and router
    const route = useRoute();
    const router = useRouter();

    // Query meetup, speaker count and related podcast
    const pageData = useAsyncData(async () => {
      // Query meetup and speaker count async
      const [meetup, speakerCount] = await Promise.all([
        // Speaker
        (
          await directus.items('meetups').readMany({
            fields: [
              'id',
              'slug',
              'published_on',
              'start_on',
              'end_on',
              'title',
              'description',
              'cover_image.*',
              'meetup_url',
              'youtube_url',
              'speakers.speaker.id',
              'speakers.speaker.slug',
              'speakers.speaker.academic_title',
              'speakers.speaker.first_name',
              'speakers.speaker.last_name',
              'speakers.speaker.description',
              'speakers.speaker.event_image.*',
              'tags.tag.id',
              'tags.tag.name',
            ],
            filter: { slug: route.value.params.slug },
            limit: 1,
          })
        ).data?.map(({ speakers, tags, ...rest }) => ({
          ...rest,
          speakers: (
            speakers as {
              speaker: Pick<
                SpeakerItem,
                | 'id'
                | 'slug'
                | 'academic_title'
                | 'first_name'
                | 'last_name'
                | 'description'
                | 'event_image'
              >;
            }[]
          )
            .map(({ speaker }) => speaker)
            .filter((speaker) => speaker),
          tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
            .map(({ tag }) => tag)
            .filter((tag) => tag),
        }))[0] as Pick<
          MeetupItem,
          | 'id'
          | 'slug'
          | 'published_on'
          | 'start_on'
          | 'end_on'
          | 'title'
          | 'description'
          | 'cover_image'
          | 'meetup_url'
          | 'youtube_url'
          | 'tags'
        > & {
          speakers: Pick<
            SpeakerItem,
            | 'id'
            | 'slug'
            | 'academic_title'
            | 'first_name'
            | 'last_name'
            | 'description'
            | 'event_image'
          >[];
        },

        // Speaker count
        (
          await directus.items('speakers').readMany({
            limit: 0,
            meta: 'total_count',
          })
        ).meta?.total_count,
      ]);

      // Throw error if meetup does not exist
      if (!meetup) {
        throw new Error('The meetup was not found.');
      }

      // Query related podcasts
      const relatedPodcasts = (
        meetup.tags.length
          ? (
              await directus.items('podcasts').readMany({
                fields: [
                  'id',
                  'slug',
                  'published_on',
                  'type',
                  'number',
                  'title',
                  'cover_image.*',
                  'audio_url',
                ],
                filter: {
                  tags: {
                    tag: {
                      name: {
                        _in: meetup.tags.map(({ name }) => name),
                      },
                    },
                  },
                } as any,
                sort: ['-published_on'],
                limit: 15,
              })
            ).data
          : []
      ) as Pick<
        PodcastItem,
        | 'id'
        | 'slug'
        | 'published_on'
        | 'type'
        | 'number'
        | 'title'
        | 'cover_image'
        | 'audio_url'
      >[];

      // Return meetup, speaker count and related podcast
      return { meetup, speakerCount, relatedPodcasts };
    });

    // Extract meetup, speaker count and related podcasts from page data
    const meetup = computed(() => pageData.value?.meetup);
    const speakerCount = computed(() => pageData.value?.speakerCount);
    const relatedPodcasts = computed(() => pageData.value?.relatedPodcasts);

    // Convert speaker count to local string
    const speakerCountString = useLocaleString(speakerCount);

    // Set loading screen
    useLoadingScreen(meetup, speakerCount);

    // Set page meta data
    useMeta(() =>
      meetup.value
        ? getMetaInfo({
            type: 'article',
            path: route.value.path,
            title: meetup.value.title,
            description: meetup.value.description,
            image: meetup.value.cover_image,
            publishedAt: meetup.value.published_on.split('T')[0],
          })
        : {}
    );

    // Create breadcrumb list
    const breadcrumbs = computed(() => [
      { label: 'Meetup', href: '/meetup' },
      { label: meetup.value?.title || '' },
    ]);

    return {
      router,
      meetup,
      speakerCountString,
      breadcrumbs,
      relatedPodcasts,
      OPEN_YOUTUBE_EVENT_ID,
      trackGoal,
    };
  },
  head: {},
});
</script>
