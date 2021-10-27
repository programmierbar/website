<template>
  <div v-if="podcast">
    <article>
      <!-- Banner -->
      <PodcastBanner :podcast="podcast" />

      <div class="relative mt-8 md:mt-14">
        <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
          <div class="flex items-center justify-between space-x-4">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />
            <LikeButton />
          </div>

          <SectionHeading class="mt-8 md:mt-0" element="h2">
            Shownotes
          </SectionHeading>

          <!-- Description -->
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
            :markdown="podcast.description"
          />

          <!-- Podcast tags -->
          <TagList
            v-if="podcast.tags.length"
            class="mt-10 md:mt-14"
            :tags="podcast.tags"
            :on-click="() => null"
          />

          <!-- Pocast download and platform links -->
          <ul class="flex items-center space-x-4 mt-12 md:mt-14">
            <li>
              <a
                class="
                  block
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
                  pt-1
                  pb-0.5
                "
                download=""
                data-cursor-hover
              >
                Download
              </a>
            </li>
            <li v-for="platform of platforms" :key="platform.name">
              <a
                class="h-8 md:h-10 lg:h-12 block"
                :href="platform.url"
                target="_blank"
                data-cursor-hover
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
        <div class="flex justify-center mt-12 md:mt-16 lg:mt-20">
          <LinkButton href="/pick-of-the-day">
            Alle 200 Picks of the Day
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
        <div class="flex justify-center mt-12 md:mt-20 lg:mt-28">
          <LinkButton href="/hall-of-fame"> Alle 67 Speaker:innen </LinkButton>
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
      <PodcastCarousel class="mt-12 md:mt-0" :podcasts="relatedPodcasts" />
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
} from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  FeedbackSection,
  LikeButton,
  LinkButton,
  MarkdownToHtml,
  PickOfTheDayList,
  PodcastBanner,
  PodcastCarousel,
  SectionHeading,
  SpeakerList,
  TagList,
} from '../../components';
import { useStrapi } from '../../composables';
import {
  getPodcastTypeString,
  getTrimmedString,
  getFullPodcastTitle,
} from '../../helpers';

export default defineComponent({
  components: {
    Breadcrumbs,
    FeedbackSection,
    LikeButton,
    LinkButton,
    MarkdownToHtml,
    PickOfTheDayList,
    PodcastBanner,
    PodcastCarousel,
    SectionHeading,
    SpeakerList,
    TagList,
  },
  setup() {
    // Get route and podcast ID param
    const route = useRoute();
    const podcastIdPath = computed(() => `/${route.value.params.id}` as const);

    // Query Strapi podcast
    const podcast = useStrapi('podcasts', podcastIdPath);

    // Set page meta data
    useMeta(() =>
      podcast.value
        ? {
            title: `${getFullPodcastTitle(podcast.value)} | programmier.bar`,
            meta: [
              {
                hid: 'description',
                name: 'description',
                content: getTrimmedString(podcast.value.description, 160),
              },
            ],
          }
        : {}
    );

    // Create podcast type
    const type = computed(
      () => podcast.value && getPodcastTypeString(podcast.value)
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
        url: podcast.value?.apple_url || process.env.NUXT_ENV_PODCAST_APPLE_URL,
      },
      {
        name: 'Google Podcast',
        icon: 'google-podcasts-color.svg',
        url:
          podcast.value?.google_url || process.env.NUXT_ENV_PODCAST_GOOGLE_URL,
      },
      {
        name: 'Spotify',
        icon: 'spotify-color.svg',
        url:
          podcast.value?.spotify_url ||
          process.env.NUXT_ENV_PODCAST_SPOTIFY_URL,
      },
      {
        name: 'RSS',
        icon: 'rss-feed-color.svg',
        url: process.env.NUXT_ENV_PODCAST_RSS_URL,
      },
    ]);

    // Create related podcasts query string
    const relatedPodcastsQuery = computed(() =>
      podcast.value && podcast.value.tags.length
        ? (`?${podcast.value.tags
            .map(
              (tag, index) =>
                `_where[_or][${index}][0][id_ne]=${
                  podcast.value!.id
                }&_where[_or][${index}][1][tags_in]=${tag.id}`
            )
            .join('&')}&_sort=published_at:DESC` as const)
        : ('?_limit=0' as const)
    );

    // Query related podcast from Strapi
    const relatedPodcasts = useStrapi('podcasts', relatedPodcastsQuery);

    return {
      podcast,
      breadcrumbs,
      platforms,
      relatedPodcasts,
    };
  },
  head: {},
});
</script>
