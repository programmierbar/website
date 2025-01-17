<template>
    <div class="relative min-h-screen overflow-hidden md:overflow-unset">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <SectionHeading class="mt-8 md:mt-0" element="h1"> Suchergebnisse </SectionHeading>

            <!-- Search results -->
            <GenericLazyList
                v-if="searchResults.length"
                class="mt-12 md:mt-16 lg:mt-28"
                :items="searchResults"
                direction="vertical"
            >
                <template #default="{ item, index, viewportItems, addViewportItem }">
                    <GenericListItem
                        :key="item.itemType + item.id"
                        class="border-b-1 border-white/70 pb-9 last:border-b-0 last:pb-0 lg:pb-24"
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
                    </GenericListItem>
                </template>
            </GenericLazyList>

            <!-- Search figure -->
            <div
                v-if="!route.query.search && !searchResults.length"
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
import GenericLazyList from '~/components/GenericLazyList.vue'
import GenericListItem from '~/components/GenericListItem.vue'
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import type { MeetupSearchItem, PickOfTheDaySearchItem, PodcastSearchItem, SpeakerSearchItem, TagItem } from '~/types'
import { getUrlSlug } from 'shared-code'
import { computed } from 'vue'

const directus = useDirectus()

// Add route
const route = useRoute()

// Query podcasts, meetups, picks of the day and speakers
const { data: searchItems } = useAsyncData(async () => {
    const [rawPodcasts, rawMeetups, rawSpeakers, rawPicksOfTheDay] = await Promise.all([
        directus.getPodcasts(),
        directus.getMeetups(),
        directus.getSpeakers(),
        directus.getPicksOfTheDay(),
    ])

    const preparedPodcast = rawPodcasts.map(({ tags, ...rest }) => ({
        ...rest,
        item_type: 'podcast',
        tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[]).map(({ tag }) => tag).filter((tag) => tag),
    })) as unknown as PodcastSearchItem[]

    const preparedMeetups = rawMeetups.map(({ tags, ...rest }) => ({
        ...rest,
        item_type: 'meetup',
        tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[]).map(({ tag }) => tag).filter((tag) => tag),
    })) as unknown as MeetupSearchItem[]

    const preparedSpeakers = rawSpeakers.map(({ tags, ...rest }) => ({
        ...rest,
        item_type: 'speaker',
        tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[]).map(({ tag }) => tag).filter((tag) => tag),
    })) as unknown as SpeakerSearchItem[]

    const preparedPicksOfTheDay = rawPicksOfTheDay.map(({ tags, ...rest }) => ({
        ...rest,
        item_type: 'pick_of_the_day',
        tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[]).map(({ tag }) => tag).filter((tag) => tag),
    })) as unknown as PickOfTheDaySearchItem[]

    return [...preparedPodcast, ...preparedMeetups, ...preparedSpeakers, ...preparedPicksOfTheDay]
})

// Set loading screen
useLoadingScreen(searchItems)

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
    SearchItem extends PodcastSearchItem | MeetupSearchItem | PickOfTheDaySearchItem | SpeakerSearchItem,
>(
    searchCrumbs: string[],
    searchItem: SearchItem,
    keys: (keyof SearchItem)[]
): boolean =>
    searchCrumbs.every(
        (searchCrumb) =>
            keys.some((key) => {
                const value = searchItem[key]
                if (typeof value === 'string') {
                    return getUrlSlug(value).includes(searchCrumb)
                }
                return false
            }) || searchItem.tags.some((tag) => tag.name.toLowerCase().includes(searchCrumb))
    )

// Get search results
const searchResults = computed(() => {
    // Check if search items exist and are not empty
    if (searchItems.value?.length) {
        // Get search text from URL query
        const searchText = route.query.search as string

        // Create an return seach results if a search text is specified
        if (searchText) {
            // Split search text in search crumbs
            const searchCrumbs = getUrlSlug(searchText).split('-')

            // Filter, sort an return podcasts, meetups,
            // picks of the day and speakers
            return (
                searchItems.value
                    .filter((searchItem) => {
                        switch (searchItem.item_type) {
                            // Podcast
                            case 'podcast':
                                return isMatchingItem(searchCrumbs, searchItem, ['type', 'number', 'description'])

                            // Meetup
                            case 'meetup':
                                return isMatchingItem(searchCrumbs, searchItem, ['title', 'description'])

                            // Pick of the day
                            case 'pick_of_the_day':
                                return isMatchingItem(searchCrumbs, searchItem, ['name', 'description'])

                            // Speaker
                            case 'speaker':
                                return isMatchingItem(searchCrumbs, searchItem, [
                                    'academic_title',
                                    'first_name',
                                    'last_name',
                                    'description',
                                ])

                            // Default
                            default:
                                return false
                        }
                    })

                    // Sort results by publication date
                    .sort((a, b) => (a.published_on < b.published_on ? 1 : -1))
            )
        }
    }

    // Otherwise return an empty array
    return []
})

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
