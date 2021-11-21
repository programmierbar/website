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
        @click="() => trackGoal(socialNetwork.eventCode)"
        v-html="require(`../assets/logos/${socialNetwork.icon}?raw`)"
      />
    </li>
  </ul>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import { trackGoal } from '../helpers';

export default defineComponent({
  setup() {
    return {
      socialNetworks: [
        {
          label: 'Twitter',
          icon: 'twitter.svg',
          href: 'https://twitter.com/programmierbar',
          eventCode: process.env.NUXT_ENV_OPEN_TWITTER_EVENT!,
        },
        {
          label: 'GitHub',
          icon: 'github.svg',
          href: 'https://github.com/programmierbar',
          eventCode: process.env.NUXT_ENV_OPEN_GITHUB_EVENT!,
        },
        {
          label: 'Meetup',
          icon: 'meetup.svg',
          href: 'https://www.meetup.com/de-DE/programmierbar/',
          eventCode: process.env.NUXT_ENV_OPEN_MEETUP_EVENT!,
        },
        {
          label: 'YouTube',
          icon: 'youtube.svg',
          href: 'https://www.youtube.com/channel/UCi9Odm-45QGUBRs5KiF1-HQ',
          eventCode: process.env.NUXT_ENV_OPEN_YOUTUBE_EVENT!,
        },
        {
          label: 'Instagram',
          icon: 'instagram.svg',
          href: 'https://www.instagram.com/programmier.bar',
          eventCode: process.env.NUXT_ENV_OPEN_INTAGRAM_EVENT!,
        },
      ],
      trackGoal,
    };
  },
});
</script>
