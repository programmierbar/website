<template>
  <div v-if="speaker">
    <article class="relative">
      <!-- Overlay gradient top -->
      <div
        class="w-full h-32 absolute -z-1 left-0 top-0 bg-gradient-to-b to-transparent opacity-40"
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
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 pt-32 md:pt-40 lg:pt-56 2xl:pt-64"
      >
        <div class="flex items-center justify-between space-x-4">
          <Breadcrumbs :breadcrumbs="breadcrumbs" />
          <!-- <LikeButton /> -->
        </div>

        <SectionHeading class="hidden md:block" element="h2">
          Informationen
        </SectionHeading>

        <div
          class="flex flex-col xs:flex-row xs:items-center xs:space-x-10 md:space-x-14 lg:space-x-16 space-y-10 xs:space-y-0 mt-14 md:mt-24 xl:mt-36"
        >
          <!-- Profile image -->
          <DirectusImage
            class="w-44 sm:w-52 lg:w-80 xl:w-96 2xl:w-112 3xl:w-120 h-44 sm:h-52 lg:h-80 xl:h-96 2xl:h-112 3xl:h-120 flex-shrink-0 object-cover rounded-full overflow-hidden"
            :image="speaker.profile_image"
            :alt="fullName"
            sizes="xs:176px sm:208px lg:320px xl:384px 2xl:448 3xl:480px"
          />

          <!-- Name, Occupation & Links -->
          <div>
            <h1
              class="text-4xl sm:text-5xl lg:text-7xl xl:text-8xl 2xl:text-9xl leading-tight font-black"
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
              class="text-base md:text-xl lg:text-2xl text-white font-bold mt-6 md:mt-8"
            >
              {{ speaker.occupation }}
            </div>
            <ul v-if="platforms.length" class="flex space-x-6 mt-6">
              <li v-for="platform of platforms" :key="platform.name">
                <a
                  class="h-7 md:h-8 lg:h-10 block text-white"
                  :href="platform.url"
                  target="_blank"
                  rel="noreferrer"
                  data-cursor-hover
                  @click="() => trackGoal(platform.eventId)"
                  v-html="platform.icon"
                />
              </li>
            </ul>
          </div>
        </div>

        <!-- Description -->
        <InnerHtml
          class="text-base md:text-xl lg:text-2xl text-white font-light leading-normal space-y-8 mt-8 md:mt-24 xl:mt-36"
          :html="speaker.description"
        />

        <!-- Speaker tags -->
        <!-- TODO: Replace navigateTo() with <a> element -->
        <TagList
          v-if="speaker.tags.length"
          class="mt-10 md:mt-14"
          :tags="speaker.tags"
          :on-click="
            (tag) =>
              navigateTo({
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

      <!-- Podcasts -->
      <PodcastSlider class="mt-12 md:mt-0" :podcasts="speaker.podcasts" />
      <div
        v-if="podcastCountString"
        class="flex justify-center px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-12 md:mt-16 lg:mt-20"
      >
        <LinkButton href="/podcast">
          Alle {{ podcastCountString }} Podcast-Folgen
        </LinkButton>
      </div>

      <!-- Picks of the Day -->
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

<script setup lang="ts">
import twitterIcon from '~/assets/logos/twitter-color.svg?raw';
import linkedinIcon from '~/assets/logos/linkedin-color.svg?raw';
import instagramIcon from '~/assets/logos/instagram-color.svg?raw';
import githubIcon from '~/assets/logos/github.svg?raw';
import youtubeIcon from '~/assets/logos/youtube-color.svg?raw';
import websiteIcon from '~/assets/logos/website-color.svg?raw';
import { computed } from 'vue';
import { getFullSpeakerName } from 'shared-code';
import {
  OPEN_SPEAKER_GITHUB_EVENT_ID,
  OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
  OPEN_SPEAKER_LINKEDIN_EVENT_ID,
  OPEN_SPEAKER_TWITTER_EVENT_ID,
  OPEN_SPEAKER_WEBSITE_EVENT_ID,
  OPEN_SPEAKER_YOUTUBE_EVENT_ID,
} from '~/config';

import { useLoadingScreen, useLocaleString } from '~/composables';
import { getMetaInfo, trackGoal } from '~/helpers';
import { directus } from '~/services';
import type {
  SpeakerItem,
  PodcastItem,
  TagItem,
  PickOfTheDayItem,
} from '~/types';
import { generatePersonFromSpeaker } from '~/helpers/jsonLdGenerator';

// Add route and router
const route = useRoute();
const router = useRouter();

// Query speaker, podcast and pick of the day count
const { data: pageData } = useAsyncData(async () => {
  // Query speaker, podcast and pick of the day count async
  const [speaker, podcastCount, pickOfTheDayCount] = await Promise.all([
    // Speaker
    (
      await directus.items('speakers').readByQuery({
        fields: [
          'academic_title',
          'first_name',
          'last_name',
          'occupation',
          'description',
          'profile_image.*',
          'website_url',
          'twitter_url',
          'linkedin_url',
          'youtube_url',
          'github_url',
          'instagram_url',
          'podcasts.podcast.id',
          'podcasts.podcast.slug',
          'podcasts.podcast.published_on',
          'podcasts.podcast.type',
          'podcasts.podcast.number',
          'podcasts.podcast.title',
          'podcasts.podcast.cover_image.*',
          'podcasts.podcast.audio_url',
          'picks_of_the_day.id',
          'picks_of_the_day.name',
          'picks_of_the_day.website_url',
          'picks_of_the_day.description',
          'picks_of_the_day.image.*',
          'tags.tag.id',
          'tags.tag.name',
        ],
        filter: { slug: route.params.slug },
        limit: 1,
      })
    ).data?.map(({ podcasts, tags, ...rest }) => ({
      ...rest,
      podcasts: (
        podcasts as {
          podcast: Pick<
            PodcastItem,
            | 'id'
            | 'slug'
            | 'published_on'
            | 'type'
            | 'number'
            | 'title'
            | 'cover_image'
            | 'audio_url'
          >;
        }[]
      )
        .map(({ podcast }) => podcast)
        .filter((podcast) => podcast),
      tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
        .map(({ tag }) => tag)
        .filter((tag) => tag),
      // TODO: Fix types and remove "as unknown"
    }))[0] as unknown as Pick<
      SpeakerItem,
      | 'academic_title'
      | 'first_name'
      | 'last_name'
      | 'occupation'
      | 'description'
      | 'profile_image'
      | 'website_url'
      | 'twitter_url'
      | 'linkedin_url'
      | 'youtube_url'
      | 'github_url'
      | 'instagram_url'
      | 'tags'
    > & {
      podcasts: Pick<
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
      picks_of_the_day: Pick<
        PickOfTheDayItem,
        'id' | 'name' | 'website_url' | 'description' | 'image'
      >[];
    },

    // Podcast count
    (
      await directus.items('podcasts').readByQuery({
        limit: 0,
        meta: 'total_count',
      })
    ).meta?.total_count,

    // Pick of the day count
    (
      await directus.items('picks_of_the_day').readByQuery({
        limit: 0,
        meta: 'total_count',
      })
    ).meta?.total_count,
  ]);

  // Throw error if speaker does not exist
  if (!speaker) {
    throw new Error('The speaker was not found.');
  }

  // Return speaker, podcast and pick of the day count
  return { speaker, podcastCount, pickOfTheDayCount };
});

// Extract speaker, podcast and pick of the day count from page data
const speaker = computed(() => pageData.value?.speaker);
const podcastCount = computed(() => pageData.value?.podcastCount);
const pickOfTheDayCount = computed(() => pageData.value?.pickOfTheDayCount);

// Set loading screen
useLoadingScreen(speaker, podcastCount, pickOfTheDayCount);

// Convert number to local string
const podcastCountString = useLocaleString(podcastCount);
const pickOfTheDayCountString = useLocaleString(pickOfTheDayCount);

// Get color from search param
const color = computed(
  () => new URLSearchParams(route.fullPath.split('?')[1]).get('color') || 'blue'
);

// Create full name
const fullName = computed(
  () => speaker.value && getFullSpeakerName(speaker.value)
);

if (speaker.value) {
  useJsonld(generatePersonFromSpeaker(speaker.value));
}

// Set page meta data
useHead(() =>
  speaker.value
    ? getMetaInfo({
        type: 'profile',
        path: route.path,
        title: fullName.value || 'Speaker',
        description: speaker.value.description,
        image: speaker.value.profile_image,
        firstName: speaker.value.first_name,
        lastName: speaker.value.last_name,
      })
    : {}
);

// Create breadcrumb list
const breadcrumbs = computed(() => [
  { label: 'Hall of Fame', href: '/hall-of-fame' },
  { label: fullName.value || '' },
]);

// Create platform list
const platforms = computed(
  () =>
    [
      {
        name: 'Twitter',
        icon: twitterIcon,
        url: speaker.value?.twitter_url,
        eventId: OPEN_SPEAKER_TWITTER_EVENT_ID,
      },
      {
        name: 'LinkedIn',
        icon: linkedinIcon,
        url: speaker.value?.linkedin_url,
        eventId: OPEN_SPEAKER_LINKEDIN_EVENT_ID,
      },
      {
        name: 'Instagram',
        icon: instagramIcon,
        url: speaker.value?.instagram_url,
        eventId: OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
      },
      {
        name: 'GitHub',
        icon: githubIcon,
        url: speaker.value?.github_url,
        eventId: OPEN_SPEAKER_GITHUB_EVENT_ID,
      },
      {
        name: 'YouTube',
        icon: youtubeIcon,
        url: speaker.value?.youtube_url,
        eventId: OPEN_SPEAKER_YOUTUBE_EVENT_ID,
      },
      {
        name: 'Website',
        icon: websiteIcon,
        url: speaker.value?.website_url,
        eventId: OPEN_SPEAKER_WEBSITE_EVENT_ID,
      },
    ].filter((platform) => platform.url) as {
      name: string;
      icon: string;
      url: string;
      eventId: string;
    }[]
);
</script>
