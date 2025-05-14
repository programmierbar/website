<template>
    <div class="group relative overflow-hidden">
        <!-- Image -->
        <DirectusImage
            class="w-full transition-transform duration-300 group-hover:scale-105"
            :image="conference.poster"
            :alt="conference.title"
            :sizes="'xs:90vw sm:90vw md:70vw lg:70vw xl:50vw 2xl:875px'"
            :loading="'lazy'"
        />

        <!-- Calendar -->
        <div
            v-if="calendar.isVisible"
            class="absolute right-0 top-0 flex h-16 w-16 flex-col items-center justify-center bg-lime text-black lg:h-20 lg:w-20"
        >
            <div class="text-sm font-light lg:text-base">
                {{ calendar.nameOfMonth }}
            </div>
            <div class="text-3xl font-black lg:text-4xl">
                {{ calendar.dayOfMonth }}
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { defineComponent, onMounted, reactive } from 'vue'
import type { ConferenceItem } from '../types';
import DirectusImage from './DirectusImage.vue'

export default defineComponent({
    components: {
        DirectusImage,
    },
    props: {
      conference: {
            type: Object as PropType<Pick<ConferenceItem, 'start_on' | 'end_on' | 'title' | 'poster'>>,
            required: true,
        },
    },
    setup(props) {
        // Create show calendar reference
        const calendar = reactive({
            isVisible: false,
            nameOfMonth: '',
            dayOfMonth: '',
        })

        // Show calendar if meetup is not over yet
        onMounted(() => {
            // Check if meetup is not over yet
            if (new Date(props.conference.end_on) > new Date()) {
                // Create start at date
                const startAt = new Date(props.conference.start_on)

                // Add name of month to calendar
                calendar.nameOfMonth = [
                    'Januar',
                    'Febr.',
                    'März',
                    'April',
                    'Mai',
                    'Juni',
                    'Juli',
                    'August',
                    'Sept.',
                    'Okt.',
                    'Nov.',
                    'Dez.',
                ][startAt.getMonth()]

                // Add day of month to calendar
                calendar.dayOfMonth = startAt.getDate().toString().padStart(2, '0')

                // Set calendar to visible
                calendar.isVisible = true
            }
        })

        return {
            calendar,
        }
    },
})
</script>
