<template>
  <div>
    {{ startAndEndTime }}
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiMeetup } from 'shared-code';

export default defineComponent({
  props: {
    meetup: {
      type: Object as PropType<StrapiMeetup>,
      required: true,
    },
  },
  setup(props) {
    // Get start and end time
    const startAndEndTime = computed(() => {
      const startDate = new Date(props.meetup.start_at);
      const endDate = new Date(props.meetup.end_at);

      // If start and end are on the same day
      if (startDate.toDateString() === endDate.toDateString()) {
        const startDateString = startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const startTimeString = startDate.toLocaleTimeString('de-DE', {
          hour: 'numeric',
          minute: 'numeric',
        });
        const endTimeString = endDate.toLocaleTimeString('de-DE', {
          hour: 'numeric',
          minute: 'numeric',
        });
        return `${startDateString} | ${startTimeString} – ${endTimeString} Uhr`;
      }

      // When start and end are on different days
      const startString = startDate.toLocaleString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      const endString = startDate.toLocaleString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      return `${startString} Uhr – ${endString} Uhr`;
    });

    return {
      startAndEndTime,
    };
  },
});
</script>
