<template>
    <div class="relative min-h-screen overflow-hidden md:overflow-unset">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <SectionHeading class="mt-8 md:mt-0" element="h1"> Suchergebnisse </SectionHeading>


          <div class='text-white'>{{ searchResults }}</div>

            <!-- Search figure -->
            <div
                v-if="!route.query.search && searchResults.length === 0"
                class="mt-20 flex h-full flex-col items-center justify-center space-y-6 md:mt-32 md:space-y-8 lg:mt-52 lg:space-y-10"
            >
              <SearchFigureIcon class="h-32 md:h-44 lg:h-60" />
                <p class="text-center text-base font-semibold text-lime md:text-lg lg:text-2xl">Wonach suchst du?</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import SearchFigureIcon from '~/assets/images/search-figure.svg'
import LazyList from '~/components/LazyList.vue'
import LazyListItem from '~/components/LazyListItem.vue'
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import { computed, type ComputedRef } from 'vue';
import type { DirectusProfileItem } from '~/types';

const directus = useDirectus()

// Add route
const route = useRoute()

const searchText = route.query.search as string

const { data: pageData } = useAsyncData(route.fullPath, async () => {

  if (!searchText) {
    return {searchResults: []}
  }

  const response = await useAsyncAlgoliaSearch({ indexName: 'programmier_bar_website_pages', query: searchText })
  return {searchResults: response.data.value.hits};

})

const searchResults: ComputedRef<Array | undefined> = computed(() => pageData.value?.searchResults)

useLoadingScreen(searchResults)

// Set page meta data
useHead(() =>
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: route.query.search
            ? `Suche – ${searchResults.value.length} Treffer`
            : 'Suche nach Podcast-Folgen, Meetups und mehr',
        noIndex: true,
    })
)

// Create breadcrumbs
const breadcrumbs = computed(() => [
    { label: 'Search' },
    ...(route.query.search ? [{ label: `${searchResults.value.length} Treffer` }] : []),
])
</script>
