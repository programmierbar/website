<template>
  <div class="flex flex-col items-center space-y-6">
    <!-- Meetup.com Button -->
    <a
      class="
        min-w-56
        md:min-w-76
        lg:min-w-88
        xl:min-w-min xl:w-full
        inline-block
        border-lime border-4
        text-lime
        rounded-full
        text-sm
        md:text-lg
        lg:text-xl
        text-center
        font-black
        tracking-widest
        uppercase
        px-10
        pt-4
        md:pt-5
        lg:pt-6
        pb-3
        md:pb-4
        lg:pb-5
      "
      :href="meetupUrl"
      target="_blank"
      rel="noreferrer"
      data-cursor-hover
      @click="() => trackGoal(meetupEventCode)"
    >
      Meetup.com
    </a>

    <!-- Calendar and maps icons -->
    <div
      v-if="icons.isVisible"
      class="h-10 md:h-12 xl:h-16 flex items-center space-x-6"
    >
      <a
        class="h-full"
        :href="icons.googleCalendarUrl"
        target="_blank"
        rel="noreferrer"
        data-cursor-hover
        @click="() => trackGoal(googleCalendarEventCode)"
        v-html="require('../assets/logos/google-calendar.svg?raw')"
      />
      <a
        class="h-full"
        :href="icons.appleCalendarUrl"
        target="_blank"
        rel="noreferrer"
        :download="icons.titleSlug"
        data-cursor-hover
        @click="() => trackGoal(appleCalendarEventCode)"
        v-html="require('../assets/logos/apple-calendar.svg?raw')"
      />
      <a
        class="h-full"
        :href="icons.googleMapsUrl"
        target="_blank"
        rel="noreferrer"
        data-cursor-hover
        @click="() => trackGoal(googleMapsEventCode)"
        v-html="require('../assets/logos/google-maps.svg?raw')"
      />
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onMounted,
  PropType,
  reactive,
} from '@nuxtjs/composition-api';
import { StrapiMeetup } from 'shared-code';
import { getUrlSlug, trackGoal } from '../helpers';

export default defineComponent({
  props: {
    meetup: {
      type: Object as PropType<StrapiMeetup>,
      required: true,
    },
  },
  setup(props) {
    const icons = reactive({
      isVisible: false,
      googleCalendarUrl: '',
      appleCalendarUrl: '',
      titleSlug: '',
      googleMapsUrl: '',
    });

    /**
     * It creates and returns a calendar date string.
     *
     * @param isoString A ISO date string.
     */
    const getCalendarDate = (isoString: string) =>
      isoString.replace(/([-:]|\.[0-9]+)/g, '');

    // Show icons if meetup is not over yet
    onMounted(() => {
      // Check if meetup is not over yet
      if (new Date(props.meetup.end_at) > new Date()) {
        // Add Google Calendar URL
        const { title } = props.meetup;
        const startAt = getCalendarDate(props.meetup.start_at);
        const endAt = getCalendarDate(props.meetup.end_at);
        icons.googleCalendarUrl = encodeURI(
          `http://www.google.com/calendar/event?action=TEMPLATE&text=${title}&dates=${startAt}/${endAt}`
        );

        // Add Apple Calendar URL
        const blob = new Blob(
          [
            'BEGIN:VCALENDAR\n',
            'VERSION:2.0\n',
            'PRODID:https://www.programmier.bar/\n',
            'BEGIN:VEVENT\n',
            `UID:meetup-${props.meetup.id}@programmier.bar\n`,
            `DTSTAMP:${getCalendarDate(props.meetup.created_at)}\n`,
            `DTSTART:${getCalendarDate(props.meetup.start_at)}\n`,
            `DTEND:${getCalendarDate(props.meetup.end_at)}\n`,
            `SUMMARY:${props.meetup.title}\n`,
            'END:VEVENT\n',
            'END:VCALENDAR',
          ],
          {
            type: 'text/calendar',
          }
        );
        icons.appleCalendarUrl = URL.createObjectURL(blob);

        // Add meetup title slug
        icons.titleSlug = getUrlSlug(props.meetup.title);

        // Add Google Maps URL
        icons.googleMapsUrl = process.env.NUXT_ENV_GOOGLE_MAPS_URL!;

        // Set icons to visible
        icons.isVisible = true;
      }
    });

    // Create Meetup URL
    const meetupUrl = computed(
      () => props.meetup.meetup_url || process.env.NUXT_ENV_MEETUP_URL
    );

    return {
      icons,
      meetupUrl,
      meetupEventCode: process.env.NUXT_ENV_OPEN_MEETUP_EVENT!,
      googleCalendarEventCode:
        process.env.NUXT_ENV_OPEN_GOOGLE_CALENDAR_EVENT_EVENT!,
      appleCalendarEventCode:
        process.env.NUXT_ENV_DOWNLOAD_CALEDNAR_EVENT_EVENT!,
      googleMapsEventCode: process.env.NUXT_ENV_OPEN_GOOGLE_MAPS_EVENT!,
      trackGoal,
    };
  },
});
</script>
