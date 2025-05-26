<template>
  <div class='w-96 speaker-box'>
    <DirectusImage
      v-if='speaker.profile_image'
      class='object-cover aspect-square'
      :image='speaker.profile_image'
      :alt='fullName'
      sizes='md:300px'
      loading='lazy'
    />
    <div class='mt-6 text-3xl p-9 flex flex-col min-h-120 max-h-120 flex-shrink-0' :class="[isExpanded ? 'max-h-full' : '']" data-cursor-hover @click='isExpanded = !isExpanded'>
      <div class=''>
        <p class='font-black mb-2'>{{ fullName }}</p>
        <p class='font-light text-xl italic'>{{ speaker.occupation }}</p>
      </div>
      <div class='relative' :class="['transition-all duration-300', !isExpanded ? 'overflow-hidden' : '']">
          <InnerHtml
            class='mt-7 font-light text-xl'
            :html='speaker.description'
          />
        <div
          v-if='!isExpanded'
          class='absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#131415] to-transparent'
        ></div>
      </div>
      <ul v-if='platforms.length' class='mt-6 flex space-x-6 flex-shrink-0'>
        <li v-for='platform of platforms' :key='platform.name'>
          <a
            class='block h-7 text-white'
            :href='platform.url'
            target='_blank'
            rel='noreferrer'
            data-cursor-hover
            @click='() => trackGoal(platform.eventId)'
          >
            <component :is='platform.icon' />
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang='ts'>
import type { SpeakerPreviewItem } from '~/types';
import { computed, ref } from 'vue';
import { getFullSpeakerName } from 'shared-code';
import { trackGoal } from '~/helpers';
import BlueskyIcon from '~/assets/logos/bluesky.svg';
import GithubIcon from '~/assets/logos/github.svg';
import InstagramIcon from '~/assets/logos/instagram.svg';
import LinkedinIcon from '~/assets/logos/linkedin.svg';
import TwitterIcon from '~/assets/logos/twitter.svg';
import WebsiteIcon from '~/assets/logos/website-color.svg';
import YoutubeIcon from '~/assets/logos/youtube.svg';
import {
  OPEN_SPEAKER_BLUESKY_EVENT_ID, OPEN_SPEAKER_GITHUB_EVENT_ID,
  OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
  OPEN_SPEAKER_LINKEDIN_EVENT_ID,
  OPEN_SPEAKER_TWITTER_EVENT_ID, OPEN_SPEAKER_WEBSITE_EVENT_ID, OPEN_SPEAKER_YOUTUBE_EVENT_ID,
} from '~/config';

const props = defineProps<{
  speaker: SpeakerPreviewItem;
}>();

const isExpanded = ref(false);

const fullName = computed(() => getFullSpeakerName(props.speaker));

// Create platform list
const platforms = computed(
  () =>
    [
      {
        name: 'Twitter',
        icon: TwitterIcon,
        url: props.speaker.twitter_url,
        eventId: OPEN_SPEAKER_TWITTER_EVENT_ID,
      },
      {
        name: 'Bluesky',
        icon: BlueskyIcon,
        url: props.speaker.bluesky_url,
        eventId: OPEN_SPEAKER_BLUESKY_EVENT_ID,
      },
      {
        name: 'LinkedIn',
        icon: LinkedinIcon,
        url: props.speaker.linkedin_url,
        eventId: OPEN_SPEAKER_LINKEDIN_EVENT_ID,
      },
      {
        name: 'Instagram',
        icon: InstagramIcon,
        url: props.speaker.instagram_url,
        eventId: OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
      },
      {
        name: 'GitHub',
        icon: GithubIcon,
        url: props.speaker.github_url,
        eventId: OPEN_SPEAKER_GITHUB_EVENT_ID,
      },
      {
        name: 'YouTube',
        icon: YoutubeIcon,
        url: props.speaker.youtube_url,
        eventId: OPEN_SPEAKER_YOUTUBE_EVENT_ID,
      },
      {
        name: 'Website',
        icon: WebsiteIcon,
        url: props.speaker.website_url,
        eventId: OPEN_SPEAKER_WEBSITE_EVENT_ID,
      },
    ].filter((platform) => platform.url) as {
      name: string
      icon: string
      url: string
      eventId: string
    }[],
);
</script>

<style scoped>
.speaker-box {
  background: var(--Grey, #131415);
}
</style>
