<template>
  <div class="flex flex-col items-center space-y-6">
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
    >
      Meetup.com
    </a>
    <div class="h-10 md:h-12 xl:h-16 flex items-center space-x-6">
      <a
        class="h-full"
        :href="googleCalendarUrl"
        target="_blank"
        rel="noreferrer"
        data-cursor-hover
        v-html="require('../assets/logos/google-calendar.svg?raw')"
      />
      <a
        class="h-full"
        :href="appleCalendarUrl"
        target="_blank"
        rel="noreferrer"
        :download="titleSlug"
        data-cursor-hover
        v-html="require('../assets/logos/apple-calendar.svg?raw')"
      />
      <a
        class="h-full"
        :href="googleMapsUrl"
        target="_blank"
        rel="noreferrer"
        data-cursor-hover
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
  ref,
} from '@nuxtjs/composition-api';
import { StrapiMeetup } from 'shared-code';
import { getUrlSlug } from '../helpers';

export default defineComponent({
  props: {
    meetup: {
      type: Object as PropType<StrapiMeetup>,
      required: true,
    },
  },
  setup(props) {
    /**
     * It creates and returns a calendar date string.
     *
     * @param isoString A ISO date string.
     */
    const getCalendarDate = (isoString: string) =>
      isoString.replace(/([-:]|\.[0-9]+)/g, '');

    // Create Meetup URL
    const meetupUrl = computed(
      () => props.meetup.meetup_url || process.env.NUXT_ENV_MEETUP_URL
    );

    // Create Google Calendar URL
    const googleCalendarUrl = computed(() => {
      const { title } = props.meetup;
      const startAt = getCalendarDate(props.meetup.start_at);
      const endAt = getCalendarDate(props.meetup.end_at);
      return encodeURI(
        `http://www.google.com/calendar/event?action=TEMPLATE&text=${title}&dates=${startAt}/${endAt}`
      );
    });

    // Create Apple Calendar URL
    const appleCalendarUrl = ref<string>();
    onMounted(() => {
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
      appleCalendarUrl.value = URL.createObjectURL(blob);
    });

    // Create meetup title slug
    const titleSlug = computed(() => getUrlSlug(props.meetup.title));

    // Create Google Maps URL
    const googleMapsUrl = computed(() => process.env.NUXT_ENV_GOOGLE_MAPS_URL);

    return {
      meetupUrl,
      googleCalendarUrl,
      appleCalendarUrl,
      titleSlug,
      googleMapsUrl,
    };
  },
});
</script>
