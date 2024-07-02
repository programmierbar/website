<template>
    <div>
        <nuxt-link class="block space-y-6 lg:flex lg:space-x-12 lg:space-y-0" :to="urlOrPath" data-cursor-more>
            <!-- Image -->
            <DirectusImage
                class="h-32 w-32 object-cover md:h-48 md:w-48 lg:h-72 lg:w-72"
                :image="image"
                :alt="heading"
                sizes="xs:128px md:192px lg:288px"
                loading="lazy"
            />
            <div>
                <!-- Type and date -->
                <div class="text-xs font-light italic text-white md:text-base lg:text-xl">
                    {{ typeAndDate }}
                </div>

                <!-- Heading -->
                <h2
                    class="mt-2 line-clamp-2 text-xl font-black leading-snug text-white md:text-3xl lg:mt-5 lg:text-4xl lg:leading-snug"
                >
                    {{ heading }}
                    <LeaveSiteIcon v-if="isExternalUrl" class="ml-1 mt-px inline-block h-4 text-white xl:h-6" />
                </h2>

                <!-- Description -->
                <p
                    class="mt-4 line-clamp-4 text-sm font-light leading-normal text-white md:text-lg lg:mt-8 lg:text-xl lg:leading-relaxed"
                >
                    {{ description }}
                </p>
            </div>
        </nuxt-link>
    </div>
</template>

<script setup lang="ts">
import LeaveSiteIcon from '~/assets/icons/leave-site.svg'
import type { SearchItem } from '~/types'
import { getFullPodcastTitle, getFullSpeakerName } from 'shared-code'
import { computed } from 'vue'
import DirectusImage from './DirectusImage.vue'

const props = defineProps<{
    item: SearchItem
}>()

// Create URL or path for <a> element
const urlOrPath = computed(() =>
    props.item.item_type === 'podcast'
        ? `/podcast/${props.item.slug}`
        : props.item.item_type === 'meetup'
          ? `/meetup/${props.item.slug}`
          : props.item.item_type === 'pick_of_the_day'
            ? props.item.website_url
            : `/hall-of-fame/${props.item.slug}`
)

// Create is external URL boolean
const isExternalUrl = computed(() => props.item.item_type === 'pick_of_the_day')

// Get image depending on item typ
const image = computed(() =>
    props.item.item_type === 'podcast' || props.item.item_type === 'meetup'
        ? props.item.cover_image
        : props.item.item_type === 'pick_of_the_day'
          ? props.item.image
          : props.item.profile_image
)

// Create type and date depending on item typ
const typeAndDate = computed(
    () =>
        (props.item.item_type === 'podcast'
            ? 'Podcast'
            : props.item.item_type === 'meetup'
              ? 'Meetup'
              : props.item.item_type === 'pick_of_the_day'
                ? 'Pick of the Day'
                : 'Speaker') +
        ' // ' +
        new Date(props.item.published_on).toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
)

// Create heading depending on item typ
const heading = computed(() =>
    props.item.item_type === 'podcast'
        ? getFullPodcastTitle(props.item)
        : props.item.item_type === 'meetup'
          ? props.item.title
          : props.item.item_type === 'pick_of_the_day'
            ? props.item.name
            : getFullSpeakerName(props.item)
)

// Create plain description text
const description = computed(() => props.item.description.replace(/<[^<>]+>/g, ''))
</script>
