<template>
  <div v-if="podcast">
    <article>
      <!-- Banner -->
      <PodcastBanner :podcast="podcast" />

      <div class="relative mt-8 md:mt-14">
        <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
          <div class="flex items-center justify-between space-x-4">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />
            <!-- <LikeButton /> -->
          </div>

          <SectionHeading class="mt-8 md:mt-0" element="h2">
            Shownotes
          </SectionHeading>

          <!-- Description -->
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
            :html="podcast.description"
          />

          <!-- Podcast tags -->
          <!-- TODO: Replace router.push() with <a> element -->
          <TagList
            v-if="podcast.tags.length"
            class="mt-10 md:mt-14"
            :tags="podcast.tags"
            :on-click="
              (tag) =>
                router.push({
                  path: '/suche',
                  query: { search: tag.name },
                })
            "
          />

          <!-- Pocast download and platform links -->
          <ul class="flex items-center space-x-4 mt-12 md:mt-14">
            <li>
              <a
                class="
                  relative
                  flex
                  items-center
                  justify-center
                  border-lime border-3
                  md:border-4
                  rounded-full
                  text-sm
                  md:text-base
                  lg:text-lg
                  text-lime
                  font-black
                  tracking-widest
                  uppercase
                  px-4
                  md:px-8
                  py-0.5
                "
                :href="downloadUrl"
                download
                data-cursor-hover
                @click="() => trackGoal(DOWNLOAD_PODCAST_EVENT_ID)"
              >
                Download
              </a>
            </li>
            <li v-for="platform of platforms" :key="platform.name">
              <a
                class="h-8 md:h-10 lg:h-12 block"
                :href="platform.url"
                target="_blank"
                rel="noreferrer"
                data-cursor-hover
                @click="() => trackGoal(platform.eventId)"
                v-html="require(`../../assets/logos/${platform.icon}?raw`)"
              />
            </li>
          </ul>
        </div>
      </div>
    </article>

    <!-- Picks of the day -->
    <section v-if="podcast.picks_of_the_day.length" class="relative">
      <div
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-20 md:mt-32 lg:mt-40"
      >
        <SectionHeading element="h2">Picks of the Day</SectionHeading>
        <PickOfTheDayList
          class="mt-12 md:mt-0"
          :picks-of-the-day="podcast.picks_of_the_day"
        />
        <div
          v-if="pickOfTheDayCountString"
          class="flex justify-center mt-12 md:mt-16 lg:mt-20"
        >
          <LinkButton href="/pick-of-the-day">
            Alle {{ pickOfTheDayCountString }} Picks of the Day
          </LinkButton>
        </div>
      </div>
    </section>

    <!-- Speakers -->
    <section v-if="podcast.speakers.length" class="relative">
      <div
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-20 md:mt-32 lg:mt-40"
      >
        <SectionHeading element="h2">Speaker Info</SectionHeading>
        <SpeakerList class="mt-12 md:mt-0" :speakers="podcast.speakers" />
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
import { getPodcastType, getFullPodcastTitle } from 'shared-code';
import {
  BUZZSPROUT_TRACKING_URL,
  DOWNLOAD_PODCAST_EVENT_ID,
  APPLE_PODCASTS_URL,
  BUZZSPROUT_RSS_FEED_URL,
  GOOGLE_PODCASTS_URL,
  OPEN_APPLE_PODCASTS_EVENT_ID,
  OPEN_GOOGLE_PODCASTS_EVENT_ID,
  OPEN_RSS_FEED_EVENT_ID,
  OPEN_SPOTIFY_EVENT_ID,
  SPOTIFY_URL,
} from '../../config';
import {
  Breadcrumbs,
  InnerHtml,
  FeedbackSection,
  // LikeButton,
  LinkButton,
  PickOfTheDayList,
  PodcastBanner,
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
import {
  PodcastItem,
  SpeakerItem,
  TagItem,
  PickOfTheDayItem,
} from '../../types';

export default defineComponent({
  components: {
    Breadcrumbs,
    InnerHtml,
    FeedbackSection,
    // LikeButton,
    LinkButton,
    PickOfTheDayList,
    PodcastBanner,
    PodcastSlider,
    SectionHeading,
    SpeakerList,
    TagList,
  },
  setup() {
    // Add route and router
    const route = useRoute();
    const router = useRouter();

    // Query podcast, pick of the day,
    // speaker count and related podcasts
    const pageData = useAsyncData(async () => {
      const [podcast, pickOfTheDayCount, speakerCount] = await Promise.all([
        // Podcast
        (
          await directus.items('podcasts').readMany({
            fields: [
              'id',
              'published_on',
              'type',
              'number',
              'title',
              'description',
              'cover_image.*',
              'banner_image.*',
              'audio_url',
              'apple_url',
              'google_url',
              'spotify_url',
              'speakers.speaker.id',
              'speakers.speaker.slug',
              'speakers.speaker.academic_title',
              'speakers.speaker.first_name',
              'speakers.speaker.last_name',
              'speakers.speaker.description',
              'speakers.speaker.event_image.*',
              'picks_of_the_day.id',
              'picks_of_the_day.name',
              'picks_of_the_day.website_url',
              'picks_of_the_day.description',
              'picks_of_the_day.image.*',
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
          PodcastItem,
          | 'id'
          | 'slug'
          | 'published_on'
          | 'type'
          | 'number'
          | 'title'
          | 'description'
          | 'cover_image'
          | 'banner_image'
          | 'audio_url'
          | 'apple_url'
          | 'google_url'
          | 'spotify_url'
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
          picks_of_the_day: Pick<
            PickOfTheDayItem,
            'id' | 'name' | 'website_url' | 'description' | 'image'
          >[];
        },

        // Pick of the day count
        (
          await directus.items('picks_of_the_day').readMany({
            limit: 0,
            meta: 'total_count',
          })
        ).meta?.total_count,

        // Speaker count
        (
          await directus.items('speakers').readMany({
            limit: 0,
            meta: 'total_count',
          })
        ).meta?.total_count,
      ]);

      // Throw error if podcast does not exist
      if (!podcast) {
        throw new Error('The podcast was not found.');
      }

      // Query related podcasts
      const relatedPodcasts = (
        podcast.tags.length
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
                  _and: [
                    {
                      id: {
                        _neq: podcast.id,
                      },
                    },
                    {
                      tags: {
                        tag: {
                          name: {
                            _in: podcast.tags.map(({ name }) => name),
                          },
                        },
                      },
                    },
                  ],
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

      // Return podcast, pick of the day and
      // speaker count and related podcasts
      return { podcast, pickOfTheDayCount, speakerCount, relatedPodcasts };
    });

    // Extract podcast, pick of the day, speaker
    // and related podcasts count from page data
    const podcast = computed(() => pageData.value?.podcast);
    const pickOfTheDayCount = computed(() => pageData.value?.pickOfTheDayCount);
    const speakerCount = computed(() => pageData.value?.speakerCount);
    const relatedPodcasts = computed(() => pageData.value?.relatedPodcasts);

    // Set loading screen
    useLoadingScreen(podcast, pickOfTheDayCount, speakerCount);

    // Convert number to local string
    const pickOfTheDayCountString = useLocaleString(pickOfTheDayCount);
    const speakerCountString = useLocaleString(speakerCount);

    // Set page meta data
    useMeta(() =>
      podcast.value
        ? getMetaInfo({
            type: 'podcast',
            path: route.value.path,
            title: getFullPodcastTitle(podcast.value),
            description: podcast.value.description,
            publishedAt: podcast.value.published_on.split('T')[0],
            image: podcast.value.cover_image,
            audioUrl: podcast.value.audio_url || undefined,
          })
        : {}
    );

    // Create podcast type
    const type = computed(() => podcast.value && getPodcastType(podcast.value));

    // Create download URL
    const downloadUrl = computed(
      () =>
        podcast.value &&
        `${BUZZSPROUT_TRACKING_URL}/${podcast.value.audio_url}?download=true`
    );

    // Create breadcrumb list
    const breadcrumbs = computed(() => [
      { label: 'Podcast', href: '/podcast' },
      { label: `${type.value} ${podcast.value?.number}` },
    ]);

    // Create platform list
    const platforms = computed(() => [
      {
        name: 'Apple Podcast',
        icon: 'apple-podcasts-color.svg',
        url: podcast.value?.apple_url || APPLE_PODCASTS_URL,
        eventId: OPEN_APPLE_PODCASTS_EVENT_ID,
      },
      {
        name: 'Google Podcast',
        icon: 'google-podcasts-color.svg',
        url: podcast.value?.google_url || GOOGLE_PODCASTS_URL,
        eventId: OPEN_GOOGLE_PODCASTS_EVENT_ID,
      },
      {
        name: 'Spotify',
        icon: 'spotify-color.svg',
        url: podcast.value?.spotify_url || SPOTIFY_URL,
        eventId: OPEN_SPOTIFY_EVENT_ID,
      },
      {
        name: 'RSS',
        icon: 'rss-feed-color.svg',
        url: BUZZSPROUT_RSS_FEED_URL,
        eventId: OPEN_RSS_FEED_EVENT_ID,
      },
    ]);

    return {
      router,
      podcast,
      pickOfTheDayCountString,
      speakerCountString,
      downloadUrl,
      breadcrumbs,
      platforms,
      relatedPodcasts,
      trackGoal,
      DOWNLOAD_PODCAST_EVENT_ID,
    };
  },
  head: {},
});
</script>
