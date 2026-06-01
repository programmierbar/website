<template>
    <div>
        {{ startAndEndTime }}
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import type { MeetupItem } from '../types'

export default defineComponent({
    props: {
        meetup: {
            type: Object as PropType<Pick<MeetupItem, 'start_on' | 'end_on'>>,
            required: true,
        },
    },
    setup(props) {
        // Format everything in Europe/Berlin so SSR (UTC) and client agree.
        const TIMEZONE = 'Europe/Berlin'

        // Get start and end time
        const startAndEndTime = computed(() => {
            const startDate = new Date(props.meetup.start_on)
            const endDate = new Date(props.meetup.end_on)

            // Determine "same day" in Berlin, not in the runtime's local tz.
            const dayFmt = new Intl.DateTimeFormat('en-CA', {
                timeZone: TIMEZONE,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            })
            const sameDay = dayFmt.format(startDate) === dayFmt.format(endDate)

            if (sameDay) {
                const startDateString = startDate.toLocaleDateString('de-DE', {
                    timeZone: TIMEZONE,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })
                const startTimeString = startDate.toLocaleTimeString('de-DE', {
                    timeZone: TIMEZONE,
                    hour: 'numeric',
                    minute: 'numeric',
                })
                const endTimeString = endDate.toLocaleTimeString('de-DE', {
                    timeZone: TIMEZONE,
                    hour: 'numeric',
                    minute: 'numeric',
                })
                return `${startDateString} | ${startTimeString} – ${endTimeString} Uhr`
            }

            // When start and end are on different days
            const startString = startDate.toLocaleString('de-DE', {
                timeZone: TIMEZONE,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
            const endString = endDate.toLocaleString('de-DE', {
                timeZone: TIMEZONE,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
            })
            return `${startString} Uhr – ${endString} Uhr`
        })

        return {
            startAndEndTime,
        }
    },
})
</script>
