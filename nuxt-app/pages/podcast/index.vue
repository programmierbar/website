<template>
    <div v-if="podcastPage && podcasts">
        <section class="relative">
            <!-- Page cover -->
            <PageCoverImage :cover-image="podcastPage.cover_image" />
            <div class="3xl:px-8 container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />

                <!-- Page intro -->
                <SectionHeading class="md:pt-2/5-screen lg:pt-1/2-screen mt-8 md:mt-0" element="h1">
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
                class="3xl:px-8 container mt-8 px-6 md:mt-20 md:pl-48 lg:mt-32 lg:pr-8"
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
import { computed } from 'vue'
import { useLoadingScreen, usePageMeta, useTagFilter } from '../../composables'
import { directus } from '../../services'
import type { PodcastItem, PodcastPage, TagItem } from '../../types'

const breadcrumbs = [{ label: 'Podcast' }]

// Query about page and members
const { data: pageData } = useAsyncData(async () => {
    const [podcastPage, podcasts] = await Promise.all([
        // Podcast page
        directus.singleton('podcast_page').read({ fields: '*.*' }) as Promise<PodcastPage>,

        // Podcasts
        (
            await directus.items('podcasts').readByQuery({
                fields: [
                    'id',
                    'slug',
                    'published_on',
                    'type',
                    'number',
                    'title',
                    'cover_image.*',
                    'audio_url',
                    'tags.tag.id',
                    'tags.tag.name',
                ],
                sort: ['-published_on'],
                limit: -1,
            })
        ).data?.map(({ tags, ...rest }) => ({
            ...rest,
            tags: (tags as { tag: Pick<TagItem, 'id' | 'name'> }[]).map(({ tag }) => tag).filter((tag) => tag),
        })) as Pick<
            PodcastItem,
            'id' | 'slug' | 'published_on' | 'type' | 'number' | 'title' | 'cover_image' | 'audio_url' | 'tags'
        >[],
    ])
    return { podcastPage, podcasts }
})

// Extract about page and members from page data
const podcastPage = computed(() => pageData.value?.podcastPage)
const podcasts = computed(() => pageData.value?.podcasts)

// Set loading screen
useLoadingScreen(podcastPage, podcasts)

// Set page meta data
usePageMeta(podcastPage)

// Create podcast tag filter
const tagFilter = useTagFilter(podcasts)

// Create deep dive podcasts list
const deepDivePodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'deep_dive'))

// Create CTO special podcasts list
const ctoSpecialPodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'cto_special'))

// Create news podcasts list
const newsPodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'news'))

// Create news podcasts list
const otherPodcasts = computed(() => tagFilter.output.filter((podcast) => podcast.type === 'other'))
</script>
