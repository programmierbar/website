<template>
    <div v-if="podcastPage && podcasts">
        <section class="relative">
            <!-- Page cover -->
            <PageCoverImage :cover-image="podcastPage.cover_image" />
            <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />

                <!-- Page intro -->
                <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                    {{ podcastPage.intro_heading }}
                </SectionHeading>
                <InnerHtml
                    class="mt-8 text-lg leading-normal text-white md:mt-16 md:text-2xl md:font-bold md:leading-normal lg:text-3xl lg:leading-normal"
                    :html="podcastPage.intro_text_1"
                />
                <InnerHtml
                    class="mt-8 text-base font-light leading-normal text-white md:mt-6 md:text-xl md:font-normal md:leading-normal lg:text-2xl lg:leading-normal"
                    :html="podcastPage.intro_text_2"
                />
            </div>
        </section>

        <div>
            <!-- Tag Filter -->
            <TagFilter
                class="container mt-8 px-6 md:mt-20 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8"
                :tags="tagFilter.tags"
                :toggle-tag="tagFilter.toggleTag"
            />

            <!-- Deep dive podcasts -->
            <section v-if="deepDivePodcasts.length" class="relative py-8 md:my-12 md:py-10 lg:my-16 lg:py-16">
                <SectionHeading class="px-6 md:px-0" element="h2">
                    {{ podcastPage.deep_dive_heading }}
                </SectionHeading>
                <PodcastSlider class="mt-10 md:mt-0" :podcasts="deepDivePodcasts" />
            </section>

            <!-- CTO special podcasts -->
            <section v-if="ctoSpecialPodcasts.length" class="relative py-8 md:my-12 md:py-10 lg:my-16 lg:py-16">
                <SectionHeading class="px-6 md:px-0" element="h2">
                    {{ podcastPage.cto_special_heading }}
                </SectionHeading>
                <PodcastSlider class="mt-10 md:mt-0" :podcasts="ctoSpecialPodcasts" />
            </section>

            <!-- News podcasts -->
            <section
                v-if="newsPodcasts.length"
                class="relative mb-8 py-8 md:mb-28 md:mt-12 md:py-10 lg:mb-40 lg:mt-16 lg:py-16"
            >
                <SectionHeading class="px-6 md:px-0" element="h2">
                    {{ podcastPage.news_heading }}
                </SectionHeading>
                <PodcastSlider class="mt-10 md:mt-0" :podcasts="newsPodcasts" />
            </section>

            <!-- Other podcasts -->
            <section
                v-if="otherPodcasts.length"
                class="relative mb-8 py-8 md:mb-28 md:mt-12 md:py-10 lg:mb-40 lg:mt-16 lg:py-16"
            >
                <SectionHeading class="px-6 md:px-0" element="h2">
                    {{ podcastPage.other_heading }}
                </SectionHeading>
                <PodcastSlider class="mt-10 md:mt-0" :podcasts="otherPodcasts" />
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
// TODO - I have the feeling that the initial load is slower.
//  Check why initial loading is slower than on live site. Probably because of the tags composable
import { useLoadingScreen, usePageMeta } from '~/composables'
import { useDirectus, type LatestPodcasts } from '~/composables/useDirectus'
import { useTagFilterNew } from '~/composables/useTagFilterNew'
import type { DirectusPodcastPage } from '~/types'
import { computed, type ComputedRef } from 'vue'

const breadcrumbs = [{ label: 'Podcast' }]
const directus = useDirectus()

// Query about page and members
const { data: pageData } = useAsyncData(async () => {
    const [podcastPage, podcasts, tags] = await Promise.all([
        directus.getPodcastPage(),
        directus.getLatestPodcasts(-1),
        directus.getTopTagsForCollection('podcasts'),
    ])

    return { podcastPage, podcasts, tags }
})

// Extract about page and members from page data
const podcastPage: ComputedRef<DirectusPodcastPage | undefined> = computed(() => pageData.value?.podcastPage)
const podcasts: ComputedRef<LatestPodcasts | undefined> = computed(() => pageData.value?.podcasts)
const tags = computed(() => pageData.value?.tags)
// Set loading screen
useLoadingScreen(podcastPage, podcasts)

// Set page meta data
usePageMeta(podcastPage)

// Create podcast tag filter
const tagFilter = useTagFilterNew(podcasts, tags)

// Create deep dive podcasts list
const deepDivePodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'deep_dive'))

// Create CTO special podcasts list
const ctoSpecialPodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'cto_special'))

// Create news podcasts list
const newsPodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'news'))

// Create news podcasts list
const otherPodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'other'))
</script>
