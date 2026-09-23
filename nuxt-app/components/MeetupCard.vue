<template>
    <div class="lg:flex lg:items-center lg:space-x-14">
        <!-- Cover -->
        <NuxtLink class="block lg:w-1/2 xl:w-5/12" :to="href" data-cursor-more>
            <MeetupCover :meetup="meetup" variant="meetup_card" />
        </NuxtLink>

        <div class="lg:w-1/2 xl:w-7/12">
            <!-- Time -->
            <MeetupStartAndEnd
                class="mt-8 text-xs font-light italic text-white md:text-sm lg:text-base"
                :meetup="meetup"
            />

            <!-- Title -->
            <h3 class="mt-4 text-xl font-black text-white md:text-2xl lg:text-3xl">
                {{ meetup.title }}
            </h3>

            <!-- Excerpt -->
            <p
                class="mt-6 line-clamp-4 space-y-8 text-base font-light leading-normal text-white md:text-xl lg:text-2xl"
            >
                {{ excerpt }}
            </p>

            <!-- Likes -->
            <LinkButton class="mt-6" :href="href">Mehr Infos</LinkButton>
        </div>
    </div>
</template>

<script lang="ts">
import { getPlainText } from '~/helpers/sanitize'
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import type { MeetupItem } from '../types'
import LinkButton from './LinkButton.vue'
import MeetupCover from './MeetupCover.vue'
import MeetupStartAndEnd from './MeetupStartAndEnd.vue'

export default defineComponent({
    components: {
        LinkButton,
        MeetupCover,
        MeetupStartAndEnd,
    },
    props: {
        meetup: {
            type: Object as PropType<
                Pick<MeetupItem, 'slug' | 'start_on' | 'end_on' | 'title' | 'intro' | 'description' | 'cover_image'>
            >,
            required: true,
        },
        variant: {
            type: String as PropType<'default' | 'meetup_page'>,
            default: 'default',
        },
    },
    setup(props) {
        // Create href to meetup subpage
        const href = computed(() => `/meetup/${props.meetup.slug}`)

        // The teaser prose belongs in `intro`; `description` carries the event details, and since
        // late 2025 that is the recurring call for Lightning-Talk speakers plus the agenda, which
        // reads as boilerplate on every card. Meetups created before then left `intro` empty and put
        // their prose in `description`, so fall back to it rather than showing an empty card.
        //
        // Both fields are CMS rich text, so both go through `getPlainText`: it strips the markup and
        // decodes entities, and it also turns an `intro` that is null or nothing but empty tags into
        // an empty string, which is what the fallback tests.
        const excerpt = computed(() => {
            const intro = getPlainText(props.meetup.intro).trim()

            return intro || getPlainText(props.meetup.description)
        })

        return {
            href,
            excerpt,
        }
    },
})
</script>
