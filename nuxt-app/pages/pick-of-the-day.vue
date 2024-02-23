<template>
    <div v-if="pickOfTheDayPage && picksOfTheDay" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Page intro -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ pickOfTheDayPage.intro_heading }}
            </SectionHeading>
            <InnerHtml
                class="mt-8 text-lg leading-normal text-white md:mt-16 md:text-2xl md:font-bold md:leading-normal lg:text-3xl lg:leading-normal"
                :html="pickOfTheDayPage.intro_text"
            />

            <!-- Tag Filter -->
            <TagFilter class="mt-12 md:mt-20 lg:mt-32" :tags="tagFilter.tags" :toggle-tag="tagFilter.toggleTag" />

            <!-- Picks of the day -->
            <LazyList
                class="mt-12 md:mt-16 lg:mt-28 lg:flex lg:flex-col lg:items-baseline"
                :items="tagFilter.output"
                direction="vertical"
            >
                <template #default="{ item, index, viewportItems, addViewportItem }">
                    <LazyListItem
                        :key="item.id"
                        class="lg:w-1/2"
                        :class="[
                            index > 0 && 'mt-8 md:mt-12',
                            index > 0 && index % 2 === 0 && 'lg:mt-44',
                            index % 2 > 0 && 'lg:-mt-2/7 lg:self-end',
                        ]"
                        :item="item"
                        :viewport-items="viewportItems"
                        :add-viewport-item="addViewportItem"
                    >
                        <template #default="{ isNewToViewport }">
                            <FadeAnimation :fade-in="isNewToViewport ? 'from_bottom' : 'none'" :threshold="0">
                                <PickOfTheDayCard
                                    :class="[
                                        index % 2 === 0 ? 'lg:origin-left' : 'lg:origin-right',
                                        (index + 3) % 4 < 2 ? 'lg:scale-70' : 'lg:scale-110',
                                    ]"
                                    :pick-of-the-day="item"
                                    :variant="(index + 3) % 4 < 2 ? 'small' : 'large'"
                                />
                            </FadeAnimation>
                        </template>
                    </LazyListItem>
                </template>
            </LazyList>
        </div>
    </div>
</template>

<script setup lang="ts">
import LazyList from '~/components/LazyList.vue'
import LazyListItem from '~/components/LazyListItem.vue'
import { useLoadingScreen, usePageMeta } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { useTagFilterNew } from '~/composables/useTagFilterNew'
import type { DirectusPickOfTheDayPage } from '~/types'
import { computed, type ComputedRef } from 'vue'

const directus = useDirectus()
const breadcrumbs = [{ label: 'Pick of the Day' }]

// Query pick of the day page and picks of the day
const { data: pageData } = useAsyncData(async () => {
    const [pickOfTheDayPage, picksOfTheDay, tags] = await Promise.all([
        // Pick of the Day page
        await directus.getPicksOfTheDayPage(),
        await directus.getPicksOfTheDay(),
        await directus.getTopTagsForCollection('picks_of_the_day'),
    ])

    return { pickOfTheDayPage, picksOfTheDay, tags }
})

// Extract pick of the day page and picks of the day from page data
const pickOfTheDayPage: ComputedRef<DirectusPickOfTheDayPage | undefined> = computed(
    () => pageData.value?.pickOfTheDayPage
)
const picksOfTheDay = computed(() => pageData.value?.picksOfTheDay)
const tags = computed(() => pageData.value?.tags)

// Set loading screen
useLoadingScreen(pickOfTheDayPage, picksOfTheDay)

// Set page meta data
usePageMeta(pickOfTheDayPage)

// Create tag filter
const tagFilter = useTagFilterNew(picksOfTheDay, tags)
</script>
