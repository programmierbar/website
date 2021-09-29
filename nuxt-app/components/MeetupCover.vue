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
      class="
        w-16
        h-16
        absolute
        top-0
        right-0
        flex flex-col
        items-center
        justify-center
        text-black
      "
      :class="[
        isInPast ? 'bg-white' : 'bg-lime',
        variant === 'default' && 'lg:w-20 lg:h-20',
      ]"
    >
      <div
        class="text-sm font-light"
        :class="variant === 'default' && 'lg:text-base'"
      >
        {{ nameOfMonth }}
      </div>
      <div
        class="text-3xl font-black"
        :class="variant === 'default' && 'lg:text-4xl'"
      >
        {{ dayOfMonth }}
      </div>
      <div v-if="isInPast" class="w-full h-0.5 absolute bg-pink -rotate-45" />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiMeetup } from 'shared-code';
import { useImageSrcSet } from '../composables';

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
    // Create normal image src set
    const coverImageSrcSet = useImageSrcSet(props.meetup.cover_image);

    // Get name of month
    const nameOfMonth = computed(
      () =>
        [
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
        ][new Date(props.meetup.start_at).getMonth()]
    );

    // Get day of month
    const dayOfMonth = computed(() =>
      new Date(props.meetup.start_at).getDate().toString().padStart(2, '0')
    );

    // Check if Meetup is in past
    const isInPast = computed(
      () => Date.now() > new Date(props.meetup.end_at).getTime()
    );

    return {
      coverImageSrcSet,
      nameOfMonth,
      dayOfMonth,
      isInPast,
    };
  },
});
</script>
