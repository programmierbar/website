<template>
    <div class="flex flex-col items-center space-y-6">
        <!-- Own registration form on this page, otherwise meetup.com -->
        <a v-if="hasOwnRegistration" :class="BUTTON_CLASS" href="#anmeldung" data-cursor-hover> Kostenlos anmelden </a>
        <a
            v-else
            :class="BUTTON_CLASS"
            :href="meetupUrl"
            target="_blank"
            rel="noreferrer"
            data-cursor-hover
            @click="() => trackGoal(OPEN_MEETUP_EVENT_ID)"
        >
            {{ meetupDomain }}
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
                rel="noreferrer"
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
import { getGoogleCalendarUrl, getMeetupCalendarEvent, getMeetupIcsPath } from 'shared-code'
import { computed, onMounted, reactive } from 'vue'
import {
    DOWNLOAD_CALEDNAR_EVENT_EVENT_ID,
    GOOGLE_MAPS_URL,
    MEETUP_URL,
    OPEN_GOOGLE_CALENDAR_EVENT_EVENT_ID,
    OPEN_GOOGLE_MAPS_EVENT_ID,
    OPEN_MEETUP_EVENT_ID,
    WEBSITE_URL,
} from '../config'
import { trackGoal } from '../helpers'
import type { MeetupItem } from '../types'

const BUTTON_CLASS =
    'inline-block min-w-56 rounded-full border-4 border-lime px-10 pb-3 pt-4 text-center text-sm font-black uppercase tracking-widest text-lime md:min-w-76 md:pb-4 md:pt-5 md:text-sm lg:min-w-88 lg:pb-5 lg:pt-6 lg:text-sm xl:w-full xl:min-w-min'

const icons = reactive({
    isVisible: false,
    googleCalendarUrl: '',
    appleCalendarUrl: '',
    googleMapsUrl: '',
})

const props = defineProps<{
    meetup: Pick<MeetupItem, 'id' | 'slug' | 'published_on' | 'start_on' | 'end_on' | 'title' | 'meetup_url'>
    /** The page shows the registration form (section `#anmeldung`). */
    hasOwnRegistration?: boolean
}>()

// Show icons if meetup is not over yet
onMounted(() => {
    // Check if meetup is not over yet
    if (new Date(props.meetup.end_on) > new Date()) {
        // Same entry as the .ics file and the confirmation mail
        icons.googleCalendarUrl = getGoogleCalendarUrl(getMeetupCalendarEvent(props.meetup, WEBSITE_URL))
        icons.appleCalendarUrl = getMeetupIcsPath(props.meetup.slug)

        // Add Google Maps URL
        icons.googleMapsUrl = GOOGLE_MAPS_URL

        // Set icons to visible
        icons.isVisible = true
    }
})

// Create Meetup URL
const meetupUrl = computed(() => props.meetup.meetup_url || MEETUP_URL)
const meetupDomain = computed(() => {
    if (props.meetup.meetup_url) {
        const url = new URL(props.meetup.meetup_url)
        return url.host.replace('www.', '')
    }

    return MEETUP_URL
})
</script>
