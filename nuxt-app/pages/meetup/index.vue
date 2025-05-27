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
        <MeetupSection v-if='meetups.length > 0' :heading='meetupPage.meetup_heading' :meetups="meetups" />

        <MeetupSection :heading='meetupPage.meetup_heading_past' :meetups="pastMeetups" />
    </div>
</template>

<script setup lang="ts">
import GenericLazyList from '~/components/GenericLazyList.vue'
import GenericListItem from '~/components/GenericListItem.vue'
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
const meetups: ComputedRef<DirectusMeetupItem[]> = computed(() => pageData.value ? pageData.value.upcomingMeetups : [])
const pastMeetups: ComputedRef<DirectusMeetupItem[]> = computed(() => pageData.value ? pageData.value.pastMeetups : [])

// Set loading screen
useLoadingScreen(meetupPage, meetups)

// Set page meta data
usePageMeta(meetupPage)
</script>
