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

        <section class="relative mb-14 mt-12 md:mb-32 md:mt-28 lg:mb-52 lg:mt-40">
            <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
                <SectionHeading element="h2">{{ meetupPage.meetup_heading_past }} </SectionHeading>
                <LazyList class="mt-10" :items="pastMeetups" direction="vertical">
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
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusMeetupItem, DirectusMeetupPage } from '~/types'
import { computed, type ComputedRef } from 'vue'

const breadcrumbs = [{ label: 'Meetup' }]
const directus = useDirectus()

// Query meetup page and meetups
const { data: pageData } = useAsyncData(async () => {
    const [meetupPage, meetups] = await Promise.all([directus.getMeetupPage(), directus.getMeetups()])

    const pastMeetups = meetups.filter((meetup) => {
        const now = new Date()

        return new Date(meetup.start_on) < now
    })

    const upcomingMeetups = meetups.filter((meetup) => {
        const now = new Date()

        return new Date(meetup.start_on) > now
    })

    return { meetupPage, upcomingMeetups, pastMeetups }
})

// Extract about page and members from page data
const meetupPage: ComputedRef<DirectusMeetupPage | undefined> = computed(() => pageData.value?.meetupPage)
const meetups: ComputedRef<DirectusMeetupItem[] | undefined> = computed(() => pageData.value?.upcomingMeetups)
const pastMeetups: ComputedRef<DirectusMeetupItem[] | undefined> = computed(() => pageData.value?.pastMeetups)

// Set loading screen
useLoadingScreen(meetupPage, meetups)

// Set page meta data
usePageMeta(meetupPage)
</script>
