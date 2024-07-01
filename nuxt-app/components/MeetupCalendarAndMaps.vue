<template>
    <div class="flex flex-col items-center space-y-6">
        <!-- Meetup.com Button -->
        <a
            class="inline-block min-w-56 rounded-full border-4 border-lime px-10 pb-3 pt-4 text-center text-sm font-black uppercase tracking-widest text-lime md:min-w-76 md:pb-4 md:pt-5 md:text-lg lg:min-w-88 lg:pb-5 lg:pt-6 lg:text-xl xl:w-full xl:min-w-min"
            :href="meetupUrl"
            target="_blank"
            rel="noreferrer"
            data-cursor-hover
            @click="() => trackGoal(OPEN_MEETUP_EVENT_ID)"
        >
            Meetup.com
        </a>

        <!-- Calendar and maps icons -->
        <div v-if="icons.isVisible" class="flex h-10 items-center space-x-6 md:h-12 xl:h-16">
            <a
                class="h-full"
                :href="icons.googleCalendarUrl"
                target="_blank"
                rel="noreferrer"
                data-cursor-hover
                @click="() => trackGoal(OPEN_GOOGLE_CALENDAR_EVENT_EVENT_ID)"
            >
                <GoogleCalendarIcon />
            </a>
            <a
                class="h-full"
                :href="icons.appleCalendarUrl"
                target="_blank"
                rel="noreferrer"
                :download="icons.titleSlug"
                data-cursor-hover
                @click="() => trackGoal(DOWNLOAD_CALEDNAR_EVENT_EVENT_ID)"
            >
                <AppleCalendarIcon />
            </a>
            <a
                class="h-full"
                :href="icons.googleMapsUrl"
                target="_blank"
                rel="noreferrer"
                data-cursor-hover
                @click="() => trackGoal(OPEN_GOOGLE_MAPS_EVENT_ID)"
            >
                <GoogleMapsIcon />
            </a>
        </div>
    </div>
</template>

<script setup lang="ts">
import AppleCalendarIcon from '~/assets/logos/apple-calendar.svg'
import GoogleCalendarIcon from '~/assets/logos/google-calendar.svg'
import GoogleMapsIcon from '~/assets/logos/google-maps.svg'
import { computed, onMounted, reactive } from 'vue'
import {
    DOWNLOAD_CALEDNAR_EVENT_EVENT_ID,
    GOOGLE_MAPS_URL,
    MEETUP_URL,
    OPEN_GOOGLE_CALENDAR_EVENT_EVENT_ID,
    OPEN_GOOGLE_MAPS_EVENT_ID,
    OPEN_MEETUP_EVENT_ID,
} from '../config'
import { trackGoal } from '../helpers'
import type { MeetupItem } from '../types'

const icons = reactive({
    isVisible: false,
    googleCalendarUrl: '',
    appleCalendarUrl: '',
    titleSlug: '',
    googleMapsUrl: '',
})

const props = defineProps<{
    meetup: Pick<MeetupItem, 'id' | 'slug' | 'published_on' | 'start_on' | 'end_on' | 'title' | 'meetup_url'>
}>()

/**
 * It creates and returns a calendar date string.
 *
 * @param isoString A ISO date string.
 */
const getCalendarDate = (isoString: string) => isoString.replace(/([-:]|\.[0-9]+)/g, '')

// Show icons if meetup is not over yet
onMounted(() => {
    // Check if meetup is not over yet
    if (new Date(props.meetup.end_on) > new Date()) {
        // Add Google Calendar URL
        const title = `programmier.bar Meetup: ${props.meetup.title}`
        const startAt = getCalendarDate(props.meetup.start_on)
        const endAt = getCalendarDate(props.meetup.end_on)
        icons.googleCalendarUrl = encodeURI(
            `http://www.google.com/calendar/event?action=TEMPLATE&text=${title}&dates=${startAt}/${endAt}`
        )

        // Add Apple Calendar URL
        const blob = new Blob(
            [
                'BEGIN:VCALENDAR\n',
                'VERSION:2.0\n',
                'PRODID:https://www.programmier.bar/\n',
                'BEGIN:VEVENT\n',
                `UID:meetup-${props.meetup.id}@programmier.bar\n`,
                `DTSTAMP:${getCalendarDate(props.meetup.published_on)}\n`,
                `DTSTART:${getCalendarDate(props.meetup.start_on)}\n`,
                `DTEND:${getCalendarDate(props.meetup.end_on)}\n`,
                `SUMMARY:${title}\n`,
                'END:VEVENT\n',
                'END:VCALENDAR',
            ],
            {
                type: 'text/calendar',
            }
        )
        icons.appleCalendarUrl = URL.createObjectURL(blob)

        // Add meetup title slug
        icons.titleSlug = props.meetup.slug

        // Add Google Maps URL
        icons.googleMapsUrl = GOOGLE_MAPS_URL

        // Set icons to visible
        icons.isVisible = true
    }
})

// Create Meetup URL
const meetupUrl = computed(() => props.meetup.meetup_url || MEETUP_URL)
</script>
