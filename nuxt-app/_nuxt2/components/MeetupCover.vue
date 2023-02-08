<template>
  <div class="group relative overflow-hidden">
    <!-- Image -->
    <DirectusImage
      class="w-full group-hover:scale-105 transition-transform duration-300"
      :image="meetup.cover_image"
      :alt="meetup.title"
      :sizes="
        variant === 'meetup_card'
          ? 'xs:90vw sm:90vw md:70vw lg:40vw xl:30vw 2xl:524px'
          : 'xs:90vw sm:90vw md:70vw lg:70vw xl:50vw 2xl:875px'
      "
      :loading="variant === 'meetup_card' ? 'lazy' : 'auto'"
    />

    <!-- Calendar -->
    <div
      v-if="calendar.isVisible"
      class="
        w-16
        h-16
        absolute
        top-0
        right-0
        flex flex-col
        items-center
        justify-center
        bg-lime
        text-black
      "
      :class="variant === 'default' && 'lg:w-20 lg:h-20'"
    >
      <div
        class="text-sm font-light"
        :class="variant === 'default' && 'lg:text-base'"
      >
        {{ calendar.nameOfMonth }}
      </div>
      <div
        class="text-3xl font-black"
        :class="variant === 'default' && 'lg:text-4xl'"
      >
        {{ calendar.dayOfMonth }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  PropType,
  reactive,
} from '@nuxtjs/composition-api';
import { MeetupItem } from '../types';
import DirectusImage from './DirectusImage.vue';

export default defineComponent({
  components: {
    DirectusImage,
  },
  props: {
    meetup: {
      type: Object as PropType<
        Pick<MeetupItem, 'start_on' | 'end_on' | 'title' | 'cover_image'>
      >,
      required: true,
    },
    variant: {
      type: String as PropType<'default' | 'meetup_card'>,
      default: 'default',
    },
  },
  setup(props) {
    // Create show calendar reference
    const calendar = reactive({
      isVisible: false,
      nameOfMonth: '',
      dayOfMonth: '',
    });

    // Show calendar if meetup is not over yet
    onMounted(() => {
      // Check if meetup is not over yet
      if (new Date(props.meetup.end_on) > new Date()) {
        // Create start at date
        const startAt = new Date(props.meetup.start_on);

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
        ][startAt.getMonth()];

        // Add day of month to calendar
        calendar.dayOfMonth = startAt.getDate().toString().padStart(2, '0');

        // Set calendar to visible
        calendar.isVisible = true;
      }
    });

    return {
      calendar,
    };
  },
});
</script>
