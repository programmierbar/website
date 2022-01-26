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
  useMeta,
  useRoute,
} from '@nuxtjs/composition-api';
import { getUrlSlug } from 'shared-code';
import {
  Breadcrumbs,
  FadeAnimation,
  LazyList,
  LazyListItem,
  SearchCard,
  SectionHeading,
} from '../components';
import { useAsyncData, useLoadingScreen } from '../composables';
import { getMetaInfo } from '../helpers';
import { directus } from '../services';
import {
  PodcastSearchItem,
  MeetupSearchItem,
  PickOfTheDaySearchItem,
  SpeakerSearchItem,
  TagItem,
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

    // Query podcasts, meetups, picks of the day and speakers
    const searchItems = useAsyncData(async () => {
      return Promise.all([
        // Podcasts
        ...((
          (
            await directus.items('podcasts').readMany({
              fields: [
                'id',
                'slug',
                'published_on',
                'type',
                'number',
                'title',
                'description',
                'cover_image.*',
                'tags.tag.id',
                'tags.tag.name',
              ],
              limit: -1,
            })
          ).data || []
        ).map(({ tags, ...rest }) => ({
          ...rest,
          item_type: 'podcast',
          tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
            .map(({ tag }) => tag)
            .filter((tag) => tag),
        })) as PodcastSearchItem[]),

        // Meetups
        ...((
          (
            await directus.items('meetups').readMany({
              fields: [
                'id',
                'slug',
                'published_on',
                'title',
                'description',
                'cover_image.*',
                'tags.tag.id',
                'tags.tag.name',
              ],
              limit: -1,
            })
          ).data || []
        ).map(({ tags, ...rest }) => ({
          ...rest,
          item_type: 'meetup',
          tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
            .map(({ tag }) => tag)
            .filter((tag) => tag),
        })) as MeetupSearchItem[]),

        // Picks of the day
        ...((
          (
            await directus.items('picks_of_the_day').readMany({
              fields: [
                'id',
                'published_on',
                'name',
                'website_url',
                'description',
                'image.*',
                'tags.tag.id',
                'tags.tag.name',
              ],
              limit: -1,
            })
          ).data || []
        ).map(({ tags, ...rest }) => ({
          ...rest,
          item_type: 'pick_of_the_day',
          tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
            .map(({ tag }) => tag)
            .filter((tag) => tag),
        })) as PickOfTheDaySearchItem[]),

        // Speaker
        ...((
          (
            await directus.items('speakers').readMany({
              fields: [
                'id',
                'slug',
                'published_on',
                'academic_title',
                'first_name',
                'last_name',
                'description',
                'profile_image.*',
                'tags.tag.id',
                'tags.tag.name',
              ],
              limit: -1,
            })
          ).data || []
        ).map(({ tags, ...rest }) => ({
          ...rest,
          item_type: 'speaker',
          tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[])
            .map(({ tag }) => tag)
            .filter((tag) => tag),
        })) as SpeakerSearchItem[]),
      ]);
    });

    // Set loading screen
    useLoadingScreen(searchItems);

    /**
     * It checks if all search crumbs match the search item.
     *
     * @param searchCrumbs The search crumbs.
     * @param searchItem The search item.
     * @param keys The searchable keys of the item.
     *
     * @returns If the search item matches.
     */
    const isMatchingItem = <
      SearchItem extends
        | PodcastSearchItem
        | MeetupSearchItem
        | PickOfTheDaySearchItem
        | SpeakerSearchItem
    >(
      searchCrumbs: string[],
      searchItem: SearchItem,
      keys: (keyof SearchItem)[]
    ): boolean =>
      searchCrumbs.every(
        (searchCrumb) =>
          keys.some((key) => {
            const value = searchItem[key];
            if (typeof value === 'string') {
              return getUrlSlug(value).includes(searchCrumb);
            }
            return false;
          }) ||
          searchItem.tags.some((tag) =>
            tag.name.toLowerCase().includes(searchCrumb)
          )
      );

    // Get search results
    const searchResults = computed(() => {
      // Check if search items exist and are not empty
      if (searchItems.value?.length) {
        // Get search text from URL query
        const searchText = route.value.query.search as string;

        // Create an return seach results if a search text is specified
        if (searchText) {
          // Split search text in search crumbs
          const searchCrumbs = getUrlSlug(searchText).split('-');

          // Filter, sort an return podcasts, meetups,
          // picks of the day and speakers
          return (
            searchItems.value
              .filter((searchItem) => {
                switch (searchItem.item_type) {
                  // Podcast
                  case 'podcast':
                    return isMatchingItem(searchCrumbs, searchItem, [
                      'type',
                      'number',
                      'description',
                    ]);

                  // Meetup
                  case 'meetup':
                    return isMatchingItem(searchCrumbs, searchItem, [
                      'title',
                      'description',
                    ]);

                  // Pick of the day
                  case 'pick_of_the_day':
                    return isMatchingItem(searchCrumbs, searchItem, [
                      'name',
                      'description',
                    ]);

                  // Speaker
                  case 'speaker':
                    return isMatchingItem(searchCrumbs, searchItem, [
                      'academic_title',
                      'first_name',
                      'last_name',
                      'description',
                    ]);

                  // Default
                  default:
                    return false;
                }
              })

              // Sort results by publication date
              .sort((a, b) => (a.published_on < b.published_on ? 1 : -1))
          );
        }
      }

      // Otherwise return an empty array
      return [];
    });

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
