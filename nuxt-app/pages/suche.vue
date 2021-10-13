<template>
  <div class="relative">
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

      <SectionHeading class="mt-8 md:mt-0" tag="h1">
        Suchergebnisse
      </SectionHeading>

      <!-- Search results -->
      <ul class="mt-12 md:mt-16 lg:mt-28">
        <li
          v-for="(item, index) of searchResults"
          :key="item.itemType + item.id"
          class="
            search-item
            border-b-1
            last:border-b-0
            border-white border-opacity-70
            pb-9
            lg:pb-24
            last:pb-0
            mb-10
            lg:mb-24
            last:mb-0
          "
          :style="`animation-delay: ${index * 0.2}s;`"
        >
          <SearchCard :item="item" />
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  ref,
  Ref,
  useRoute,
} from '@nuxtjs/composition-api';
import {
  StrapiPodcast,
  StrapiMeetup,
  StrapiPickOfTheDay,
  StrapiSpeaker,
} from 'shared-code';
import { Breadcrumbs, SearchCard, SectionHeading } from '../components';
import { useStrapi } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    SearchCard,
    SectionHeading,
  },
  setup() {
    // Add route
    const route = useRoute();

    // Query podcasts, meetups, picks of the day and speakers from strapi
    const podcasts = useStrapi('podcasts', ref('?_limit=-1'));
    const meetups = useStrapi('meetups', ref('?_limit=-1'));
    const picksOfTheDay = useStrapi('picks-of-the-day', ref('?_limit=-1'));
    const speakers = useStrapi('speakers', ref('?_limit=-1'));

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
          .replace(/([^\s\w\d-_#:.])/g, '')
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

    // Create breadcrumbs
    const breadcrumbs = computed(() => [
      { label: 'Search' },
      ...(route.value.query.search
        ? [{ label: `${searchResults.value.length} Treffer` }]
        : []),
    ]);

    return {
      searchResults,
      breadcrumbs,
    };
  },
});
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateX(10%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.search-item {
  animation: fade-in 0.5s ease both;
}
</style>