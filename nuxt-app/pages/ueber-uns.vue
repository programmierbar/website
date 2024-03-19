<template>
    <div v-if="aboutPage && podcastCrewMembers && behindTheScenesMembers">
        <section class="relative overflow-hidden md:overflow-unset">
            <!-- Page cover -->
            <PageCoverImage :cover-image="aboutPage.cover_image" />
            <div class="container mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />

                <!-- Page intro -->
                <SectionHeading class="mt-8 md:mt-0 md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                    {{ aboutPage.podcast_crew_heading }}
                </SectionHeading>
                <InnerHtml
                    class="mt-8 space-y-8 text-lg leading-normal text-white md:mt-16 md:text-2xl md:font-bold md:leading-normal lg:text-3xl lg:leading-normal"
                    :html="aboutPage.intro_text"
                />

                <!-- Podcast crew members -->
                <ul class="flex flex-wrap justify-between">
                    <li
                        v-for="(member, index) in podcastCrewMembers"
                        :key="member.id"
                        class="mt-20 md:w-2/5"
                        :class="index % 2 === 0 ? 'md:mt-32' : 'md:mt-60'"
                    >
                        <MemberCard :member="member" :color="memberColors[index % 3]" />
                    </li>
                </ul>
            </div>
        </section>

        <!-- Behind the scenes members -->
        <section class="relative mb-20 md:mb-40 lg:mb-60">
            <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
                <SectionHeading class="mt-20 md:mt-0 md:pt-32" element="h2">
                    {{ aboutPage.behind_the_scenes_heading }}
                </SectionHeading>
                <ul class="flex flex-wrap justify-between">
                    <li
                        v-for="(member, index) in behindTheScenesMembers"
                        :key="member.id"
                        class="md:w-2/5"
                        :class="[index > 0 ? 'mt-20' : 'mt-12', index % 2 === 0 ? 'md:mt-32' : 'md:mt-72']"
                    >
                        <MemberCard :member="member" :color="memberColors[index % 3]" />
                    </li>
                </ul>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { computed, type ComputedRef } from 'vue'
import { useLoadingScreen, usePageMeta } from '../composables'
import type { DirectusAboutPage } from '../types'

const directus = useDirectus()
const breadcrumbs = [{ label: 'Über uns' }]
const memberColors = ['pink', 'blue', 'lime'] as const

// Query about page and members
const { data: pageData } = useAsyncData(async () => {
    const [aboutPage, podcastCrewMembers, behindTheScenesMembers] = await Promise.all([
        // About page
        await directus.getAboutPage(),
        // Podcast crew members
        await directus.getMembers({
            task_area: { _eq: 'podcast_crew' },
        }),
        // Behind the Scenes members
        await directus.getMembers({
            task_area: { _eq: 'behind_the_scenes' },
        }),
    ])

    return { aboutPage, podcastCrewMembers, behindTheScenesMembers }
})

// Extract about page and members
const aboutPage: ComputedRef<DirectusAboutPage | undefined> = computed(() => pageData.value?.aboutPage)
const podcastCrewMembers = computed(() => pageData.value?.podcastCrewMembers)
const behindTheScenesMembers = computed(() => pageData.value?.behindTheScenesMembers)

// Set loading screen
useLoadingScreen(aboutPage, podcastCrewMembers, behindTheScenesMembers)

// Set page meta data
usePageMeta(aboutPage)
</script>
