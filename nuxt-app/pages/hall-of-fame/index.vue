<template>
    <div v-if="hallOfFamePage && speakers" class="relative">
        <div class="container px-6 pt-32 md:pl-48 md:pt-40 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Page intro -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ hallOfFamePage.intro_heading }}
            </SectionHeading>
            <InnerHtml
                class="mt-8 text-lg leading-normal text-white md:mt-16 md:text-2xl md:font-bold md:leading-normal lg:text-3xl lg:leading-normal"
                :html="hallOfFamePage.intro_text"
            />
        </div>

        <div>
            <!-- Tag Filter -->
            <TagFilter
                class="container mt-12 px-6 md:mt-20 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8"
                :tags="tagFilter.tags"
                :toggle-tag="tagFilter.toggleTag"
            />

            <!-- Speaker bubbles -->
            <div
                class="container overflow-hidden px-6 pb-24 pt-10 xs:pt-14 sm:pt-16 md:pb-32 md:pl-48 md:overflow-unset lg:pb-52 lg:pr-8 lg:pt-20 xl:pt-32 3xl:px-8"
            >
                <LazyList class="flex flex-col items-baseline" :items="tagFilter.output" direction="vertical">
                    <template #default="{ item, index, viewportItems, addViewportItem }">
                        <LazyListItem
                            :key="item.id"
                            :class="[
                                index > 0 && 'mt-10',
                                index % 2 ? 'self-end xs:-mt-10 sm:-mt-20 xl:-mt-32 2xl:-mt-60' : 'xs:-mt-5 sm:-mt-10',
                            ]"
                            :item="item"
                            :viewport-items="viewportItems"
                            :add-viewport-item="addViewportItem"
                        >
                            <template #default="{ isNewToViewport }">
                                <FadeAnimation :fade-in="isNewToViewport ? 'from_bottom' : 'none'">
                                    <SpeakerBubble :speaker="item" :color="bubbleColors[index % 3]" />
                                </FadeAnimation>
                            </template>
                        </LazyListItem>
                    </template>
                </LazyList>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import LazyList from '~/components/LazyList.vue'
import LazyListItem from '~/components/LazyListItem.vue'
import { useLoadingScreen, usePageMeta } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { useTagFilterNew } from '~/composables/useTagFilterNew'
import type { DirectusHallOfFamePage } from '~/types'
import { computed, type ComputedRef } from 'vue'

const breadcrumbs = [{ label: 'Hall of Fame' }]
const bubbleColors = ['pink', 'blue', 'lime'] as const
const directus = useDirectus()

// Query hall of fame page and speakers
const { data: pageData } = useAsyncData(async () => {
    const [hallOfFamePage, speakers, tags] = await Promise.all([
        // Hall of fame page
        directus.getHallOfFamePage(),
        directus.getSpeakers(),
        directus.getTopTagsForCollection('speakers'),
    ])
    return { hallOfFamePage, speakers, tags }
})

// Extract hall of fame page and speakers from page data
const hallOfFamePage: ComputedRef<DirectusHallOfFamePage | undefined> = computed(() => pageData.value?.hallOfFamePage)
const speakers = computed(() => pageData.value?.speakers)
const tags = computed(() => pageData.value?.tags)

// Set loading screen
useLoadingScreen(hallOfFamePage, speakers)

// Set page meta data
usePageMeta(hallOfFamePage)

// Create tag filter
const tagFilter = useTagFilterNew(speakers, tags)
</script>
