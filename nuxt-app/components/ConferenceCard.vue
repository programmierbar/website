<template>
    <div class="lg:flex lg:items-center lg:space-x-14">
        <!-- Cover -->
        <NuxtLink class="block lg:w-1/2 xl:w-5/12" :to="href" data-cursor-more>
            <ConferenceCover :conference="conference" />
        </NuxtLink>

        <div class="lg:w-1/2 xl:w-7/12">
            <MeetupStartAndEnd
                class="mt-8 text-xs font-light italic text-white md:text-sm lg:text-base"
                :meetup="conference"
            />

            <!-- Title -->
            <h3 class="mt-4 text-xl font-black text-white md:text-2xl lg:text-3xl">
                {{ conference.title }}
            </h3>

            <!-- Description -->
            <p
                class="mt-6 line-clamp-4 space-y-8 text-base font-light leading-normal text-white md:text-xl lg:text-2xl"
                v-html="description"
            />

            <!-- Likes -->
            <LinkButton class="mt-6" :href="href">Mehr Infos</LinkButton>
        </div>
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import type { ConferenceItem, MeetupItem } from '../types'
import ConferenceCover from './ConferenceCover.vue'
import LinkButton from './LinkButton.vue'
import MeetupStartAndEnd from './MeetupStartAndEnd.vue'

export default defineComponent({
    components: {
        LinkButton,
        ConferenceCover,
        MeetupStartAndEnd,
    },
    props: {
        conference: {
            type: Object as PropType<
                Pick<ConferenceItem, 'slug' | 'start_on' | 'end_on' | 'title' | 'text_1' | 'cover_image' | 'poster'>
            >,
            required: true,
        },
    },
    setup(props) {
        // Create href to meetup subpage
        const href = computed(() => `/konferenzen/${props.conference.slug}`)

        // Create plain description text
        const description = computed(() => props.conference.text_1?.replace(/<[^<>]+>/g, ''))

        return {
            href,
            description,
        }
    },
})
</script>
