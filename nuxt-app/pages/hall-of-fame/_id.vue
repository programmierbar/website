<template>
  <div v-if="speaker">
    <article class="relative">
      <!-- Overlay gradient top -->
      <div
        class="
          w-full
          h-32
          absolute
          -z-1
          left-0
          top-0
          bg-gradient-to-b
          to-transparent
          opacity-40
        "
        :class="
          color === 'lime'
            ? 'from-lime'
            : color === 'pink'
            ? 'from-pink'
            : 'from-blue'
        "
      />

      <!-- Speaker content -->
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
          <LikeButton />
        </div>

        <SectionHeading class="hidden md:block" element="h2">
          Informationen
        </SectionHeading>

        <div
          class="
            flex flex-col
            xs:flex-row xs:items-center xs:space-x-10
            md:space-x-14
            lg:space-x-16
            space-y-10
            xs:space-y-0
            mt-14
            md:mt-24
            xl:mt-36
          "
        >
          <!-- Profile image -->
          <img
            class="
              w-44
              sm:w-52
              lg:w-80
              xl:w-96
              2xl:w-112
              3xl:w-120
              h-44
              sm:h-52
              lg:h-80
              xl:h-96
              2xl:h-112
              3xl:h-120
              flex-shrink-0
              object-cover
              rounded-full
              overflow-hidden
            "
            :src="speaker.profile_image.url"
            :srcset="profileImageSrcSet"
            sizes="
              (min-width: 2000px) 480px,
              (min-width: 1536px) 448px,
              (min-width: 1280px) 384px,
              (min-width: 1024px) 320px,
              (min-width: 640px) 208px,
              176px
            "
            :alt="speaker.profile_image.alternativeText || fullName"
          />

          <!-- Name, Occupation & Links -->
          <div>
            <h1
              class="
                text-4xl
                sm:text-5xl
                lg:text-7xl
                xl:text-8xl
                2xl:text-9xl
                leading-tight
                font-black
              "
              :class="
                color === 'lime'
                  ? 'text-lime'
                  : color === 'pink'
                  ? 'text-pink'
                  : 'text-blue'
              "
            >
              {{ fullName }}
            </h1>
            <div
              class="
                text-base
                md:text-xl
                lg:text-2xl
                text-white
                font-bold
                mt-6
                md:mt-8
              "
            >
              {{ speaker.occupation }}
            </div>
            <ul v-if="platforms.length" class="flex space-x-6 mt-6">
              <li v-for="platform of platforms" :key="platform.name">
                <a
                  class="h-7 md:h-8 lg:h-10 block text-white"
                  :href="platform.url"
                  target="_blank"
                  data-cursor-hover
                  v-html="require(`../../assets/logos/${platform.icon}?raw`)"
                />
              </li>
            </ul>
          </div>
        </div>

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
            md:mt-24
            xl:mt-36
          "
          :markdown="speaker.description"
        />

        <!-- Speaker tags -->
        <!-- TODO: Replace router.push() with <a> element -->
        <TagList
          v-if="speaker.tags.length"
          class="mt-10 md:mt-14"
          :tags="speaker.tags"
          :on-click="
            (tag) =>
              router.push({
                path: '/suche',
                query: { search: tag.name },
              })
          "
        />
      </div>
    </article>

    <!-- More content -->
    <section
      v-if="speaker.podcasts.length || speaker.picks_of_the_day.length"
      class="relative mt-20 md:mt-32 lg:mt-40"
    >
      <SectionHeading class="px-6 md:px-0" element="h2">
        Verwandter Inhalt
      </SectionHeading>
      <div
        v-if="speaker.podcasts.length < 3"
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-12 md:mt-0"
      >
        <div class="w-full flex flex-wrap -m-8 lg:-m-12">
          <PodcastCard
            v-for="podcast of speaker.podcasts"
            :key="podcast.id"
            class="m-8 lg:m-12"
            :podcast="podcast"
          />
        </div>
        <div
          v-if="podcastCountString"
          class="flex justify-center mt-12 md:mt-16 lg:mt-20"
        >
          <LinkButton href="/podcast">
            Alle {{ podcastCountString }} Podcast-Folgen
          </LinkButton>
        </div>
      </div>
      <PodcastCarousel
        v-else
        class="md:pl-40 3xl:px-0 mt-12 md:mt-0"
        :podcasts="speaker.podcasts"
      />
      <div
        v-if="speaker.picks_of_the_day.length"
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-20 md:mt-32 lg:mt-40"
      >
        <PickOfTheDayList :picks-of-the-day="speaker.picks_of_the_day" />
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

    <!-- Feedback CTA -->
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
  LikeButton,
  LinkButton,
  MarkdownToHtml,
  PickOfTheDayList,
  PodcastCard,
  PodcastCarousel,
  TagList,
  SectionHeading,
} from '../../components';
import { useStrapi, useLocaleString, useImageSrcSet } from '../../composables';
import { getTrimmedString } from '../../helpers';

export default defineComponent({
  components: {
    Breadcrumbs,
    FeedbackSection,
    LikeButton,
    LinkButton,
    MarkdownToHtml,
    PickOfTheDayList,
    PodcastCard,
    PodcastCarousel,
    TagList,
    SectionHeading,
  },
  setup() {
    // Add router
    const router = useRouter();

    // Get route and speaker ID param
    const route = useRoute();
    const speakerIdPath = computed(() => `/${route.value.params.id}` as const);

    // Query Strapi speaker
    const speaker = useStrapi('speakers', speakerIdPath);

    // Query Strapi podcast and pick of the day count
    const podcastCount = useStrapi('podcasts', '/count');
    const pickOfTheDayCount = useStrapi('picks-of-the-day', '/count');

    // Convert number to local string
    const podcastCountString = useLocaleString(podcastCount);
    const pickOfTheDayCountString = useLocaleString(pickOfTheDayCount);

    // Get color from search param
    const color = computed(
      () =>
        new URLSearchParams(route.value.fullPath.split('?')[1]).get('color') ||
        'blue'
    );

    // Create full name
    const fullName = computed(() =>
      `${speaker.value?.academic_title || ''} ${speaker.value?.first_name} ${
        speaker.value?.last_name
      }`.trim()
    );

    // Set page meta data
    useMeta(() =>
      speaker.value
        ? {
            title: `Speaker – ${fullName.value} | programmier.bar`,
            meta: [
              {
                hid: 'description',
                name: 'description',
                content: getTrimmedString(speaker.value.description, 160),
              },
            ],
          }
        : {}
    );

    // Create breadcrumb list
    const breadcrumbs = computed(() => [
      { label: 'Hall of Fame', href: '/hall-of-fame' },
      { label: fullName.value },
    ]);

    // Create profile image src set
    const profileImageSrcSet = useImageSrcSet(speaker.value?.profile_image);

    // Create platform list
    const platforms = computed(
      () =>
        [
          {
            name: 'Twitter',
            icon: 'twitter-color.svg',
            url: speaker.value?.twitter_url,
          },
          {
            name: 'LinkedIn',
            icon: 'linkedin-color.svg',
            url: speaker.value?.linkedin_url,
          },
          {
            name: 'Instagram',
            icon: 'instagram-color.svg',
            url: speaker.value?.instagram_url,
          },
          {
            name: 'GitHub',
            icon: 'github.svg',
            url: speaker.value?.github_url,
          },
          {
            name: 'YouTube',
            icon: 'youtube-color.svg',
            url: speaker.value?.youtube_url,
          },
          {
            name: 'Website',
            icon: 'website-color.svg',
            url: speaker.value?.website_url,
          },
        ].filter((platform) => platform.url) as {
          name: string;
          icon: string;
          url: string;
        }[]
    );

    return {
      router,
      color,
      speaker,
      podcastCountString,
      pickOfTheDayCountString,
      breadcrumbs,
      fullName,
      profileImageSrcSet,
      platforms,
    };
  },
  head: {},
});
</script>
