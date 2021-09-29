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
        data-cursor-hover
        v-html="require(`../assets/logos/${socialNetwork.icon}?raw`)"
      />
    </li>
  </ul>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';

export default defineComponent({
  setup() {
    return {
      socialNetworks: [
        {
          label: 'Twitter',
          icon: 'twitter.svg',
          href: 'https://twitter.com/programmierbar',
        },
        {
          label: 'GitHub',
          icon: 'github.svg',
          href: 'https://github.com/programmierbar',
        },
        {
          label: 'Meetup',
          icon: 'meetup.svg',
          href: 'https://www.meetup.com/de-DE/programmierbar/',
        },
        {
          label: 'YouTube',
          icon: 'youtube.svg',
          href: 'https://www.youtube.com/channel/UCi9Odm-45QGUBRs5KiF1-HQ',
        },
        {
          label: 'Instagram',
          icon: 'instagram.svg',
          href: 'https://www.instagram.com/programmier.bar',
        },
      ],
    };
  },
});
</script>
