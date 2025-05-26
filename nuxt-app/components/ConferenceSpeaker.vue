<template>
  <div class='w-96 speaker-box'>
    <DirectusImage
      v-if="speaker.profile_image"
      class="object-cover aspect-square"
      :image="speaker.profile_image"
      :alt="fullName"
      sizes="md:300px"
      loading="lazy"
    />
    <div class='mt-6 text-3xl p-9'>
      <p class='font-black mb-2'>{{ fullName }}</p>
      <p class='font-light text-xl italic'>{{ speaker.occupation }}</p>
      <InnerHtml
        class="mt-7 font-light text-xl"
        :html="speaker.description"
      />
      <ul v-if="platforms.length" class="mt-6 flex space-x-6">
        <li v-for="platform of platforms" :key="platform.name">
          <a
            class="block h-7 text-white md:h-8 lg:h-10"
            :href="platform.url"
            target="_blank"
            rel="noreferrer"
            data-cursor-hover
            @click="() => trackGoal(platform.eventId)"
          >
            <component :is="platform.icon" />
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang='ts'>
import type { SpeakerPreviewItem } from '~/types';
import { computed } from 'vue';
import { getFullSpeakerName } from 'shared-code';
import { trackGoal } from '~/helpers';
import BlueskyIcon from '~/assets/logos/bluesky-color.svg'
import GithubIcon from '~/assets/logos/github.svg'
import InstagramIcon from '~/assets/logos/instagram-color.svg'
import LinkedinIcon from '~/assets/logos/linkedin-color.svg'
import TwitterIcon from '~/assets/logos/twitter-color.svg'
import WebsiteIcon from '~/assets/logos/website-color.svg'
import YoutubeIcon from '~/assets/logos/youtube-color.svg'
import {
  OPEN_SPEAKER_BLUESKY_EVENT_ID, OPEN_SPEAKER_GITHUB_EVENT_ID,
  OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
  OPEN_SPEAKER_LINKEDIN_EVENT_ID,
  OPEN_SPEAKER_TWITTER_EVENT_ID, OPEN_SPEAKER_WEBSITE_EVENT_ID, OPEN_SPEAKER_YOUTUBE_EVENT_ID,
} from '~/config';
const props = defineProps<{
  speaker: SpeakerPreviewItem;
}>();

const fullName = computed(() => getFullSpeakerName(props.speaker))


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
    }[]
)
</script>

<style scoped>
.speaker-box {
  background: var(--Grey, #131415);
}
</style>
