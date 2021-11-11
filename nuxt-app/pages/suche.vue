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
        <template #default="{ item, index }">
          <li
            :key="item.itemType + item.id"
            class="
              border-b-1
              last:border-b-0
              border-white border-opacity-70
              pb-9
              lg:pb-24
              last:pb-0
            "
            :class="index > 0 && 'mt-10 lg:mt-24'"
          >
            <FadeAnimation fade-in="from_right">
              <SearchCard :item="item" />
            </FadeAnimation>
          </li>
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
          Nach was möchtest du suchen?
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  Ref,
  useMeta,
  useRoute,
} from '@nuxtjs/composition-api';
import {
  StrapiPodcast,
  StrapiMeetup,
  StrapiPickOfTheDay,
  StrapiSpeaker,
} from 'shared-code';
import {
  Breadcrumbs,
  FadeAnimation,
  LazyList,
  SearchCard,
  SectionHeading,
} from '../components';
import { useStrapi } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    FadeAnimation,
    LazyList,
    SearchCard,
    SectionHeading,
  },
  setup() {
    // Add route
    const route = useRoute();

    // Query podcasts, meetups, picks of the day and speakers from strapi
    const podcasts = useStrapi('podcasts', '?_limit=-1');
    const meetups = useStrapi('meetups', '?_limit=-1');
    const picksOfTheDay = useStrapi('picks-of-the-day', '?_limit=-1');
    const speakers = useStrapi('speakers', '?_limit=-1');

    /**
     * It filters the list by the keys and search crumbs.
     *
     * @param itemType The type of list items.
     * @param list The list to be filtered.
     * @param keys The searchable keys of the list.
     * @param searchCrumbs The search crumbs.
     *
     * @returns The filtered list.
     */
    const getFilteredData = <
      ListItem extends
        | StrapiPodcast
        | StrapiMeetup
        | StrapiPickOfTheDay
        | StrapiSpeaker,
      ItemType extends 'podcast' | 'meetup' | 'pick_of_the_day' | 'speaker'
    >(
      itemType: ItemType,
      list: Ref<ListItem[] | null>,
      keys: (keyof ListItem)[],
      searchCrumbs: string[]
    ): (ListItem & { itemType: ItemType })[] =>
      // Filter list
      (list.value || [])
        .filter((item) =>
          // Check if every search crumb is included
          // in value of keys or in tags
          searchCrumbs.every(
            (searchCrumb) =>
              keys.some((key) => {
                const value = item[key];
                if (typeof value === 'string') {
                  return value.toLowerCase().includes(searchCrumb);
                }
                return false;
              }) ||
              item.tags.some((tag) =>
                tag.name.toLowerCase().includes(searchCrumb)
              )
          )
        )
        // Add item type to object
        .map((item) => ({ ...item, itemType }));

    // Get search results
    const searchResults = computed(() => {
      // Get search text from URL query
      const searchText = route.value.query.search as string;

      // Create an return seach results if a search text is specified
      if (searchText) {
        // Split search text in search crumbs
        const searchCrumbs = searchText
          .replace(/([^\s\w-_#:.äöüß])/gi, '')
          .replace(/(\s|-|_|#|:|\.)+/g, ' ')
          .toLowerCase()
          .split(' ');

        // Filter, sort an return podcasts, meetups,
        // picks of the day and speakers
        return [
          ...getFilteredData(
            'podcast',
            podcasts,
            ['type', 'number', 'description', 'transcript'],
            searchCrumbs
          ),
          ...getFilteredData(
            'meetup',
            meetups,
            ['title', 'description'],
            searchCrumbs
          ),
          ...getFilteredData(
            'pick_of_the_day',
            picksOfTheDay,
            ['name', 'description'],
            searchCrumbs
          ),
          ...getFilteredData(
            'speaker',
            speakers,
            [
              'academic_title',
              'first_name',
              'last_name',
              'occupation',
              'website_url',
              'description',
            ],
            searchCrumbs
          ),
        ].sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
      }

      // Otherwise return an empty array
      return [];
    });

    // Set page meta data
    useMeta(() => ({
      title: `${
        route.value.query.search
          ? `Suche – ${searchResults.value.length} Treffer`
          : 'Suche nach Podcast-Folgen, Meetups und mehr'
      } | programmier.bar`,
      meta: [
        { hid: 'description', name: 'description', content: '' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    }));

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
