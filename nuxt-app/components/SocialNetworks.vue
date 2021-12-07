<template>
  <ul class="flex space-x-5">
    <li
      v-for="socialNetwork in socialNetworks"
      :key="socialNetwork.href"
      class="h-full"
    >
      <a
        class="h-full block text-white hover:text-lime"
        :href="socialNetwork.href"
        target="_blank"
        rel="noreferrer"
        data-cursor-hover
        @click="() => trackGoal(socialNetwork.eventId)"
        v-html="require(`../assets/logos/${socialNetwork.icon}?raw`)"
      />
    </li>
  </ul>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import {
  OPEN_GITHUB_EVENT_ID,
  OPEN_INTAGRAM_EVENT_ID,
  OPEN_MEETUP_EVENT_ID,
  OPEN_TWITTER_EVENT_ID,
  OPEN_YOUTUBE_EVENT_ID,
} from '../config';
import { trackGoal } from '../helpers';

export default defineComponent({
  setup() {
    return {
      socialNetworks: [
        {
          label: 'Twitter',
          icon: 'twitter.svg',
          href: 'https://twitter.com/programmierbar',
          eventId: OPEN_TWITTER_EVENT_ID,
        },
        {
          label: 'GitHub',
          icon: 'github.svg',
          href: 'https://github.com/programmierbar',
          eventId: OPEN_GITHUB_EVENT_ID,
        },
        {
          label: 'Meetup',
          icon: 'meetup.svg',
          href: 'https://www.meetup.com/de-DE/programmierbar/',
          eventId: OPEN_MEETUP_EVENT_ID,
        },
        {
          label: 'YouTube',
          icon: 'youtube.svg',
          href: 'https://www.youtube.com/channel/UCi9Odm-45QGUBRs5KiF1-HQ',
          eventId: OPEN_YOUTUBE_EVENT_ID,
        },
        {
          label: 'Instagram',
          icon: 'instagram.svg',
          href: 'https://www.instagram.com/programmier.bar',
          eventId: OPEN_INTAGRAM_EVENT_ID,
        },
      ],
      trackGoal,
    };
  },
});
</script>
