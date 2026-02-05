<template>
    <li class="flex flex-col md:flex-row-reverse md:items-center">
        <!-- Event image -->
        <NuxtLink
            v-if="hasImage"
            class="block md:ml-16 md:h-60 md:w-1/2 lg:ml-20 lg:h-80 xl:h-96 2xl:h-112"
            :to="href"
            data-cursor-hover
        >
            <DirectusImage
                v-if="speaker.event_image"
                class="h-full w-full object-cover"
                :image="speaker.event_image"
                :alt="fullName"
                sizes="xs:90vw sm:90vw md:40vw lg:40vw xl:40vw 2xl:656px 3xl:696px"
                loading="lazy"
            />
        </NuxtLink>

        <div class="mt-10 md:mt-0" :class="hasImage ? 'md:w-1/2' : ''">
            <!-- Name -->
            <h3 class="text-xl font-black text-white md:text-2xl lg:text-3xl">
                {{ fullName }}
            </h3>

            <!-- Description -->
            <p
                class="mt-5 line-clamp-4 space-y-8 text-base font-light leading-normal text-white md:mt-10 md:text-xl lg:text-2xl"
                v-html="description"
            />

            <!-- Link -->
            <LinkButton class="mt-6" :href="href">Mehr Infos</LinkButton>
        </div>
    </li>
</template>

<script lang="ts">
import { getFullSpeakerName } from 'shared-code'
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import type { SpeakerItem } from '../types'
import DirectusImage from './DirectusImage.vue'
import LinkButton from './LinkButton.vue'

export default defineComponent({
    components: {
        DirectusImage,
        LinkButton,
    },
    props: {
        speaker: {
            type: Object as PropType<
                Pick<
                    SpeakerItem,
                    'slug' | 'academic_title' | 'first_name' | 'last_name' | 'description' | 'event_image'
                >
            >,
            required: true,
        },
    },
    setup(props) {
        // Create get full name function
        const fullName = computed(() => getFullSpeakerName(props.speaker))

        // Create plain description text
        const description = computed(() => props.speaker.description.replace(/<[^<>]+>/g, ''))

        // Create href to speaker's subpage
        const href = computed(() => `/hall-of-fame/${props.speaker.slug}`)

        const hasImage = computed(() => Boolean(props.speaker.event_image))

        return {
            fullName,
            description,
            href,
            hasImage,
        }
    },
})
</script>
