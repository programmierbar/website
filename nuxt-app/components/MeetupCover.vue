<template>
  <div class="group relative overflow-hidden">
    <!-- Image -->
    <img
      class="w-full group-hover:scale-105 transition-transform duration-300"
      :src="meetup.cover_image.url"
      :srcset="coverImageSrcSet"
      :sizes="
        variant === 'meetup_card'
          ? `
            (min-width: 1536px) 524px,
            (min-width: 1280px) 30vw,
            (min-width: 1024px) 40vw,
            (min-width: 768px) 70vw,
            90vw
          `
          : `
            (min-width: 1536px) 875px,
            (min-width: 1280px) 50vw,
            (min-width: 768px) 70vw,
            90vw
          `
      "
      :loading="variant === 'meetup_card' ? 'lazy' : 'auto'"
      :alt="meetup.cover_image.alternativeText || meetup.title"
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
  computed,
  defineComponent,
  onMounted,
  PropType,
  reactive,
} from '@nuxtjs/composition-api';
import { StrapiMeetup } from 'shared-code';
import { getImageSrcSet } from '../helpers';

export default defineComponent({
  props: {
    meetup: {
      type: Object as PropType<StrapiMeetup>,
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
      if (new Date(props.meetup.end_at) > new Date()) {
        // Create start at date
        const startAt = new Date(props.meetup.start_at);

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

    // Create normal image src set
    const coverImageSrcSet = computed(() =>
      getImageSrcSet(props.meetup.cover_image)
    );

    return {
      calendar,
      coverImageSrcSet,
    };
  },
});
</script>
