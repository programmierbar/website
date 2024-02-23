<template>
    <div v-if="meetupPage && meetups">
        <section class="relative">
            <!-- Page cover -->
            <PageCoverImage :cover-image="meetupPage.cover_image" />
            <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />

                <!-- Page intro -->
                <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                    {{ meetupPage.intro_heading }}
                </SectionHeading>
                <InnerHtml
                    class="mt-8 text-lg font-bold leading-normal text-white md:mt-16 md:text-2xl md:leading-normal lg:text-3xl lg:leading-normal"
                    :html="meetupPage.intro_text_1"
                />
                <InnerHtml
                    class="mt-8 text-base font-light leading-normal text-white md:mt-6 md:text-xl md:font-normal md:leading-normal lg:text-2xl lg:leading-normal"
                    :html="meetupPage.intro_text_2"
                />

                <!-- Corona info -->
                <InnerHtml
                    class="lg::mt-32 mt-10 space-y-6 text-sm font-bold italic leading-relaxed text-lime md:mt-20 md:text-lg md:leading-relaxed lg:text-xl lg:leading-relaxed"
                    :html="meetupPage.corona_text"
                />
            </div>
        </section>

        <!-- Meetups -->
        <section class="relative mb-14 mt-12 md:mb-32 md:mt-28 lg:mb-52 lg:mt-40">
            <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
                <SectionHeading element="h2">
                    {{ meetupPage.meetup_heading }}
                </SectionHeading>
                <LazyList class="mt-10" :items="meetups" direction="vertical">
                    <template #default="{ item, index, viewportItems, addViewportItem }">
                        <LazyListItem
                            :key="item.id"
                            :class="index > 0 && 'mt-14 md:mt-20 lg:mt-28'"
                            :item="item"
                            :viewport-items="viewportItems"
                            :add-viewport-item="addViewportItem"
                        >
                            <template #default="{ isNewToViewport }">
                                <FadeAnimation :fade-in="isNewToViewport ? 'from_right' : 'none'">
                                    <MeetupCard :meetup="item" />
                                </FadeAnimation>
                            </template>
                        </LazyListItem>
                    </template>
                </LazyList>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import LazyList from '~/components/LazyList.vue'
import LazyListItem from '~/components/LazyListItem.vue'
import { useLoadingScreen, usePageMeta } from '~/composables'
import { directus } from '~/services'
import type { MeetupItem, MeetupPage } from '~/types'
import { computed } from 'vue'

const breadcrumbs = [{ label: 'Meetup' }]

// Query meetup page and meetups
const { data: pageData } = useAsyncData(async () => {
    const [meetupPage, meetups] = await Promise.all([
        // Meetup page
        directus.singleton('meetup_page').read({ fields: '*.*' }) as Promise<MeetupPage>,

        // Meetups
        (
            await directus.items('meetups').readByQuery({
                fields: ['id', 'slug', 'start_on', 'end_on', 'title', 'description', 'cover_image.*'],
                sort: ['-start_on'],
                limit: -1,
            })
        ).data as Pick<MeetupItem, 'id' | 'start_on' | 'end_on' | 'title' | 'description' | 'cover_image'>[],
    ])
    return { meetupPage, meetups }
})

// Extract about page and members from page data
const meetupPage = computed(() => pageData.value?.meetupPage)
const meetups = computed(() => pageData.value?.meetups)

// Set loading screen
useLoadingScreen(meetupPage, meetups)

// Set page meta data
usePageMeta(meetupPage)
</script>
