<template>
  <div class="lg:flex lg:items-center lg:space-x-14">
    <!-- Cover -->
    <NuxtLink class="lg:w-1/2 xl:w-5/12 block" :to="href" data-cursor-more>
      <MeetupCover :meetup="meetup" variant="meetup_card" />
    </NuxtLink>

    <div class="lg:w-1/2 xl:w-7/12">
      <!-- Time -->
      <MeetupStartAndEnd
        class="
          text-xs
          md:text-sm
          lg:text-base
          text-white
          font-light
          italic
          mt-8
        "
        :meetup="meetup"
      />

      <!-- Title -->
      <h3 class="text-xl md:text-2xl lg:text-3xl text-white font-black mt-4">
        {{ meetup.title }}
      </h3>

      <!-- Description -->
      <p
        class="
          text-base
          md:text-xl
          lg:text-2xl
          text-white
          font-light
          leading-normal
          line-clamp-4
          space-y-8
          mt-6
        "
      >
        {{ description }}
      </p>

      <!-- Likes -->
      <LinkButton class="mt-6" :href="href">Mehr Infos</LinkButton>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { MeetupItem } from '../types';
import LinkButton from './LinkButton.vue';
import MeetupCover from './MeetupCover.vue';
import MeetupStartAndEnd from './MeetupStartAndEnd.vue';

export default defineComponent({
  components: {
    LinkButton,
    MeetupCover,
    MeetupStartAndEnd,
  },
  props: {
    meetup: {
      type: Object as PropType<
        Pick<
          MeetupItem,
          | 'slug'
          | 'start_on'
          | 'end_on'
          | 'title'
          | 'description'
          | 'cover_image'
        >
      >,
      required: true,
    },
    variant: {
      type: String as PropType<'default' | 'meetup_page'>,
      default: 'default',
    },
  },
  setup(props) {
    // Create href to meetup subpage
    const href = computed(() => `/meetup/${props.meetup.slug}`);

    // Create plain description text
    const description = computed(() =>
      props.meetup.description.replace(/<[^<>]+>/g, '')
    );

    return {
      href,
      description,
    };
  },
});
</script>
