<template>
  <div class="lg:flex lg:items-center lg:space-x-14">
    <!-- Cover -->
    <NuxtLink
      class="lg:w-1/2 xl:w-5/12 block"
      :to="`/meetup/${meetup.id}`"
      data-cursor-more
    >
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
      <MarkdownToHtml
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
        :markdown="meetup.description"
      />

      <!-- Likes -->
      <LinkButton class="mt-6" :href="`/meetup/${meetup.id}`">
        Mehr Infos
      </LinkButton>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiMeetup } from 'shared-code';
import LinkButton from './LinkButton.vue';
import MarkdownToHtml from './MarkdownToHtml.vue';
import MeetupCover from './MeetupCover.vue';
import MeetupStartAndEnd from './MeetupStartAndEnd.vue';

export default defineComponent({
  components: {
    LinkButton,
    MarkdownToHtml,
    MeetupCover,
    MeetupStartAndEnd,
  },
  props: {
    meetup: {
      type: Object as PropType<StrapiMeetup>,
      required: true,
    },
    variant: {
      type: String as PropType<'default' | 'meetup_page'>,
      default: 'default',
    },
  },
});
</script>
