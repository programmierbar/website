<template>
    <div>
        <nuxt-link class="block space-y-6 lg:flex lg:space-x-12 lg:space-y-0" :to="item.url" data-cursor-more>
          <nuxt-img
            class="h-32 w-32 object-cover md:h-48 md:w-48 lg:h-72 lg:w-72"
            :src="item.image"
            sizes="xs:128px md:192px lg:288px"
            loading="lazy"
            quality="80"
            fit="cover"
          />

            <div>
                <!-- Type and date -->
                <div class="text-xs font-light italic text-white md:text-base lg:text-xl">

                </div>

                <!-- Heading -->
                <h2
                    class="mt-2 line-clamp-2 text-xl font-black leading-snug text-white md:text-3xl lg:mt-5 lg:text-4xl lg:leading-snug"
                >
                    {{ item.title }}
                </h2>

                <!-- Description -->
                <p
                    class="mt-4 line-clamp-4 text-sm font-light leading-normal text-white md:text-lg lg:mt-8 lg:text-xl lg:leading-relaxed"
                    v-html="item.description"
                />
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
    item: {
      url: string,
      title: string,
      description: string,
      image: string,
    }
}>()
</script>
