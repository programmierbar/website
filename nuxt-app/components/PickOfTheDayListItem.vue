<template>
    <li>
        <!-- Website URL -->
        <a
            class="group flex flex-col space-y-6 md:flex-row md:items-center md:space-x-8 md:space-y-0"
            :href="pickOfTheDay.website_url"
            target="_blank"
            rel="noreferrer"
            data-cursor-hover
        >
            <div class="w-56 flex-shrink-0 md:w-44 lg:w-48">
                <div class="relative w-full bg-gray-900" style="padding-top: 56.25%">
                    <!-- Image -->
                    <DirectusImage
                        v-if="pickOfTheDay.image"
                        class="absolute left-0 top-0 h-full w-full object-cover"
                        :image="pickOfTheDay.image"
                        :alt="pickOfTheDay.name"
                        sizes="xs:224px md:176px lg:192px"
                        loading="lazy"
                    />
                </div>
            </div>

            <!-- Name and description -->
            <div class="text-white group-hover:text-blue">
                <div class="flex items-center space-x-4">
                    <h3 class="text-lg font-black md:text-xl lg:text-2xl">
                        {{ pickOfTheDay.name }}
                    </h3>
                    <LeaveSiteIcon class="-mt-1 h-4 lg:h-5 xl:h-6" />
                </div>
                <p class="mt-2 space-y-8 text-base font-light leading-normal md:text-xl lg:text-2xl">
                    {{ description }}
                </p>
            </div>
        </a>
    </li>
</template>

<script setup lang="ts">
import LeaveSiteIcon from '~/assets/icons/leave-site.svg'
import type { PickOfTheDayItem } from '~/types'
import { computed } from 'vue'
import DirectusImage from './DirectusImage.vue'

const props = defineProps<{
    pickOfTheDay: Pick<PickOfTheDayItem, 'name' | 'website_url' | 'description' | 'image'>
}>()

const description = computed(() => props.pickOfTheDay.description.replace(/<[^<>]+>/g, ''))
</script>
