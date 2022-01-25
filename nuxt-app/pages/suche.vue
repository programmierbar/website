<template>
  <div class="min-h-screen relative overflow-hidden md:overflow-unset">
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

      <SectionHeading class="mt-8 md:mt-0" element="h1">
        Suchergebnisse
      </SectionHeading>

      <!-- Search results -->
      <LazyList
        v-if="searchResults.length"
        class="mt-12 md:mt-16 lg:mt-28"
        :items="searchResults"
        direction="vertical"
      >
        <template #default="{ item, index, viewportItems, addViewportItem }">
          <LazyListItem
            :key="item.itemType + item.id"
            class="
              border-b-1
              last:border-b-0
              border-white/70
              pb-9
              lg:pb-24
              last:pb-0
            "
            :class="index > 0 && 'mt-10 lg:mt-24'"
            :item="item"
            :viewport-items="viewportItems"
            :add-viewport-item="addViewportItem"
          >
            <template #default="{ isNewToViewport }">
              <FadeAnimation :fade-in="isNewToViewport ? 'from_right' : 'none'">
                <SearchCard :item="item" />
              </FadeAnimation>
            </template>
          </LazyListItem>
        </template>
      </LazyList>

      <!-- Search figure -->
      <div
        v-if="!route.query.search && !searchResults.length"
        class="
          h-full
          flex flex-col
          items-center
          justify-center
          space-y-6
          md:space-y-8
          lg:space-y-10
          mt-20
          md:mt-32
          lg:mt-52
        "
      >
        <div
          class="h-32 md:h-44 lg:h-60"
          v-html="require('../assets/images/search-figure.svg?raw')"
        />
        <p
          class="
            text-base
            md:text-lg
            lg:text-2xl
            text-lime text-center
            font-semibold
          "
        >
          Wonach suchst du?
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onMounted,
  useMeta,
  useRoute,
  ref,
  watch,
} from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  FadeAnimation,
  LazyList,
  LazyListItem,
  SearchCard,
  SectionHeading,
} from '../components';
import { getMetaInfo } from '../helpers';
import { directus } from '../services';
import {
  PodcastSearchItem,
  MeetupSearchItem,
  PickOfTheDaySearchItem,
  SpeakerSearchItem,
  SearchItem,
} from '../types';

export default defineComponent({
  components: {
    Breadcrumbs,
    FadeAnimation,
    LazyList,
    LazyListItem,
    SearchCard,
    SectionHeading,
  },
  setup() {
    // Add route
    const route = useRoute();

    // Create search results reference
    const searchResults = ref<SearchItem[]>([]);

    // Create timeout variable
    let timeout: NodeJS.Timeout;

    /**
     * It fetches the search results from our Directus CMS.
     *
     * @param search The search string.
     */
    const fetchSearchResults = (search: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        searchResults.value = search
          ? (
              await Promise.all([
                // Podcasts
                ...((
                  (
                    await directus.items('podcasts').readMany({
                      search,
                      limit: 10,
                      fields: [
                        'id',
                        'slug',
                        'published_on',
                        'type',
                        'number',
                        'title',
                        'description',
                        'cover_image.*',
                      ],
                    })
                  ).data || []
                ).map((podcast) => ({
                  ...podcast,
                  item_type: 'podcast',
                })) as PodcastSearchItem[]),

                // Meetups
                ...((
                  (
                    await directus.items('meetups').readMany({
                      search,
                      limit: 10,
                      fields: [
                        'id',
                        'slug',
                        'published_on',
                        'title',
                        'description',
                        'cover_image.*',
                      ],
                    })
                  ).data || []
                ).map((meetup) => ({
                  ...meetup,
                  item_type: 'meetup',
                })) as MeetupSearchItem[]),

                // Picks of the day
                ...((
                  (
                    await directus.items('picks_of_the_day').readMany({
                      search,
                      limit: 10,
                      fields: [
                        'id',
                        'published_on',
                        'name',
                        'website_url',
                        'description',
                        'image.*',
                      ],
                    })
                  ).data || []
                ).map((pickOfTheDay) => ({
                  ...pickOfTheDay,
                  item_type: 'pick_of_the_day',
                })) as PickOfTheDaySearchItem[]),

                // Speaker
                ...((
                  (
                    await directus.items('speakers').readMany({
                      search,
                      limit: 10,
                      fields: [
                        'id',
                        'slug',
                        'published_on',
                        'academic_title',
                        'first_name',
                        'last_name',
                        'description',
                        'profile_image.*',
                      ],
                    })
                  ).data || []
                ).map((speaker) => ({
                  ...speaker,
                  item_type: 'speaker',
                })) as SpeakerSearchItem[]),
              ])
            ).sort((a, b) => (a.published_on < b.published_on ? 1 : -1))
          : [];
      }, 200);
    };

    // Fetch initial search results
    onMounted(() => fetchSearchResults(route.value.query.search as string));

    // Refetch search results when search changes
    watch(() => route.value.query.search as string, fetchSearchResults);

    // Set page meta data
    useMeta(() =>
      getMetaInfo({
        type: 'website',
        path: route.value.path,
        title: route.value.query.search
          ? `Suche – ${searchResults.value.length} Treffer`
          : 'Suche nach Podcast-Folgen, Meetups und mehr',
        noIndex: true,
      })
    );

    // Create breadcrumbs
    const breadcrumbs = computed(() => [
      { label: 'Search' },
      ...(route.value.query.search
        ? [{ label: `${searchResults.value.length} Treffer` }]
        : []),
    ]);

    return {
      route,
      searchResults,
      breadcrumbs,
    };
  },
  head: {},
});
</script>
