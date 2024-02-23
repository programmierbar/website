<template>
    <div class="group relative" data-cursor-black>
        <!-- 16:9 aspect ratio -->
        <div class="relative w-full overflow-hidden" style="padding-top: 56.25%">
            <div class="absolute left-0 top-0 h-full w-full bg-white">
                <!-- Link & heading -->
                <a
                    class="absolute z-10 m-4 inline-flex items-center space-x-3 bg-lime px-4 pb-3 pt-4 md:m-6 lg:m-4 xl:m-6"
                    :href="pickOfTheDay.website_url"
                    target="_blank"
                    rel="noreferrer"
                    data-cursor-hover
                >
                    <h2
                        class="text-base font-black text-black selection:bg-black selection:text-white md:text-xl xl:text-2xl 2xl:text-3xl"
                    >
                        {{ pickOfTheDay.name }}
                    </h2>
                    <div class="-mt-1 h-4 text-black lg:h-5 xl:h-6" v-html="leaveSiteIcon" />
                </a>

                <!-- Background image overlay -->
                <div class="absolute left-0 top-0 h-full w-full bg-black bg-opacity-30" />

                <!-- Background image -->
                <DirectusImage
                    v-if="pickOfTheDay.image"
                    class="h-full w-full object-cover"
                    :image="pickOfTheDay.image"
                    :alt="pickOfTheDay.name"
                    :sizes="
                        variant === 'large'
                            ? 'xs:90vw sm:90vw md:74vw lg:43vw xl:43vw 2xl:722px'
                            : 'xs:90vw sm:90vw md:74vw lg:28vw xl:28vw 2xl:460px'
                    "
                    loading="lazy"
                />
            </div>
        </div>

        <!-- Content box -->
        <div
            class="w-full transition-all duration-0 lg:invisible lg:absolute lg:left-0 lg:top-0 lg:h-full lg:p-4 lg:delay-300 lg:group-hover:visible lg:group-hover:delay-0 xl:p-6"
        >
            <div class="relative w-full lg:h-full">
                <!-- Background color -->
                <div
                    class="absolute left-0 top-0 h-full w-full bg-lime lg:origin-top-left lg:scale-0 lg:transition-transform lg:duration-300 lg:group-hover:scale-100"
                />

                <!-- Content -->
                <div
                    class="relative w-full lg:absolute lg:left-0 lg:top-0 lg:h-full lg:overflow-y-auto lg:overscroll-y-contain lg:opacity-0 lg:transition-opacity lg:duration-300 lg:group-hover:opacity-100 lg:group-hover:delay-300 lg:group-hover:duration-700"
                >
                    <div
                        class="flex min-h-full flex-col items-start justify-end space-y-6 px-4 pb-4 pt-8 md:px-6 md:pb-6 md:pt-10 lg:px-4 lg:pb-4 lg:pt-16 xl:pt-20"
                    >
                        <!-- Podcast episode -->
                        <NuxtLink
                            v-if="pickOfTheDay.podcast"
                            class="text-xs italic text-black underline xs:text-sm lg:translate-y-4 lg:transition-transform lg:delay-300 lg:duration-0 lg:group-hover:translate-y-0 lg:group-hover:delay-200 lg:group-hover:duration-500 xl:text-base"
                            :to="podcastHref ?? undefined"
                            data-cursor-hover
                        >
                            <strong>{{ podcastTypeAndNumber }}</strong>
                            {{ podcastTitleDivider }}{{ pickOfTheDay.podcast.title }}
                        </NuxtLink>

                        <!-- Description -->
                        <InnerHtml
                            class="text-sm text-black xs:text-base lg:translate-y-3 lg:opacity-0 lg:transition lg:delay-300 lg:duration-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-hover:delay-400 lg:group-hover:duration-500 xl:text-lg 2xl:text-xl"
                            :html="pickOfTheDay.description"
                            variant="pick_of_the_day_card"
                        />

                        <div
                            class="flex w-full items-end justify-end space-x-6 md:flex-col md:items-start md:justify-end md:space-x-0 md:space-y-6 lg:translate-y-2 lg:opacity-0 lg:transition lg:delay-300 lg:duration-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-hover:delay-500 lg:group-hover:duration-500"
                        >
                            <!-- Tags -->
                            <!-- TODO: Replace navigateTo() with <a> element -->
                            <TagList
                                v-if="pickOfTheDay.tags.length"
                                class="flex-grow"
                                :tags="pickOfTheDay.tags"
                                variant="pick_of_the_day_card"
                                :on-click="
                                    (tag) =>
                                        navigateTo({
                                            path: '/suche',
                                            query: { search: tag.name },
                                        })
                                "
                            />

                            <!-- Likes -->
                            <!-- <LikeButton class="self-end" variant="pick_of_the_day_card" /> -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import leaveSiteIcon from '~/assets/icons/leave-site.svg?raw'
import type { PickOfTheDayItem, PodcastItem, TagItem } from '~/types'
import { getPodcastTitleDivider, getPodcastTypeAndNumber } from 'shared-code'
import { computed } from 'vue'
import DirectusImage from './DirectusImage.vue'
import InnerHtml from './InnerHtml.vue'
import TagList from './TagList.vue'

const props = defineProps<{
    pickOfTheDay: Pick<PickOfTheDayItem, 'name' | 'website_url' | 'description' | 'image'> & {
        podcast: Pick<PodcastItem, 'slug' | 'type' | 'number' | 'title'> | null
        tags: Pick<TagItem, 'id' | 'name'>[]
    }
    variant: 'small' | 'large'
}>()

// Add router
const router = useRouter()

// Create podcast href to podcast subpage
const podcastHref = computed(() => props.pickOfTheDay.podcast && `/podcast/${props.pickOfTheDay.podcast.slug}`)

// Create podcast type and number
const podcastTypeAndNumber = computed(
    () => props.pickOfTheDay.podcast && getPodcastTypeAndNumber(props.pickOfTheDay.podcast)
)

// Create podcast title divider
const podcastTitleDivider = computed(
    () => props.pickOfTheDay.podcast && getPodcastTitleDivider(props.pickOfTheDay.podcast)
)
</script>
