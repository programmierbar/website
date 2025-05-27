<template>
  <ul v-if='platformList.length' class='mt-6 flex space-x-6 flex-shrink-0'>
    <li v-for='platform of platformList' :key='platform.name'>
      <a
        class='block text-white'
        :class='sizes'
        :href='platform.url'
        target='_blank'
        rel='noreferrer'
        data-cursor-hover
        @click='() => {if (platform.eventId) trackGoal(platform.eventId)}'
      >
        <component :is='platform.icon' />
      </a>
    </li>
  </ul>
</template>

<script setup lang="ts">
import BlueskyIcon from '~/assets/logos/bluesky.svg'
import GithubIcon from '~/assets/logos/github.svg'
import InstagramIcon from '~/assets/logos/instagram.svg'
import LinkedinIcon from '~/assets/logos/linkedin.svg'
import MastodonIcon from '~/assets/logos/mastodon.svg'
import TwitterIcon from '~/assets/logos/twitter.svg'
import YoutubeIcon from '~/assets/logos/youtube.svg'
import WebsiteIconColor from '~/assets/logos/website-color.svg'
import BlueskyIconColor from '~/assets/logos/bluesky-color.svg'
import InstagramIconColor from '~/assets/logos/instagram-color.svg'
import LinkedinIconColor from '~/assets/logos/linkedin-color.svg'
import TwitterIconColor from '~/assets/logos/twitter-color.svg'
import YoutubeIconColor from '~/assets/logos/youtube-color.svg'

import {
  OPEN_MEMBER_BLUESKY_EVENT_ID,
  OPEN_MEMBER_GITHUB_EVENT_ID,
  OPEN_MEMBER_INSTAGRAM_EVENT_ID,
  OPEN_MEMBER_LINKEDIN_EVENT_ID,
  OPEN_MEMBER_MASTODON_EVENT_ID,
  OPEN_MEMBER_TWITTER_EVENT_ID,
  OPEN_MEMBER_WEBSITE_EVENT_ID,
  OPEN_MEMBER_YOUTUBE_EVENT_ID,
  OPEN_SPEAKER_WEBSITE_EVENT_ID,
  OPEN_SPEAKER_GITHUB_EVENT_ID,
  OPEN_SPEAKER_YOUTUBE_EVENT_ID,
  OPEN_SPEAKER_MASTODON_EVENT_ID,
  OPEN_SPEAKER_INSTAGRAM_EVENT_ID,
  OPEN_SPEAKER_TWITTER_EVENT_ID,
  OPEN_SPEAKER_LINKEDIN_EVENT_ID,
  OPEN_SPEAKER_BLUESKY_EVENT_ID,
} from '../config';
import { trackGoal } from '../helpers'
import { computed } from 'vue';

type Scope = 'speaker' | 'member'
type Style = 'mono' | 'color'

interface Platforms {
  twitter_url?: string
  bluesky_url?: string
  linkedin_url?: string
  instagram_url?: string
  github_url?: string
  mastodon_url?: string
  youtube_url?: string
  website_url?: string
}

const props = withDefaults(
  defineProps<{
    platforms?: Platforms,
    scope: Scope,
    style?: Style,
    sizes?: string,
  }>(),
  {
    platforms: () => ({
      twitter_url: '',
      bluesky_url: '',
      linkedin_url: '',
      instagram_url: '',
      github_url: '',
      mastodon_url: '',
      youtube_url: '',
      website_url: '',
    }),
    style: 'mono',
    sizes: 'h-7',
  }
)

const platformList = computed(() => {

  const BLUESKY_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_BLUESKY_EVENT_ID : OPEN_MEMBER_BLUESKY_EVENT_ID;
  const MASTODON_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_MASTODON_EVENT_ID : OPEN_MEMBER_MASTODON_EVENT_ID;
  const LINKEDIN_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_LINKEDIN_EVENT_ID : OPEN_MEMBER_LINKEDIN_EVENT_ID;
  const INSTAGRAM_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_INSTAGRAM_EVENT_ID : OPEN_MEMBER_INSTAGRAM_EVENT_ID;
  const GITHUB_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_GITHUB_EVENT_ID : OPEN_MEMBER_GITHUB_EVENT_ID;
  const YOUTUBE_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_YOUTUBE_EVENT_ID : OPEN_MEMBER_YOUTUBE_EVENT_ID;
  const WEBSITE_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_WEBSITE_EVENT_ID : OPEN_MEMBER_WEBSITE_EVENT_ID;
  const TWITTER_EVENT_ID = props.scope === 'speaker' ? OPEN_SPEAKER_TWITTER_EVENT_ID : OPEN_MEMBER_TWITTER_EVENT_ID;

  const BLUESKY_ICON = props.style === 'color' ? BlueskyIconColor : BlueskyIcon;
  const INSTAGRAM_ICON = props.style === 'color' ? InstagramIconColor : InstagramIcon;
  const LINKEDIN_ICON = props.style === 'color' ? LinkedinIconColor : LinkedinIcon;
  const TWITTER_ICON = props.style === 'color' ? TwitterIconColor : TwitterIcon;
  const YOUTUBE_ICON = props.style === 'color' ? YoutubeIconColor : YoutubeIcon;
  const WEBSITE_ICON = props.style === 'color' ? WebsiteIconColor : WebsiteIconColor;
  const GITHUB_ICON = props.style === 'color' ? GithubIcon : GithubIcon;

  return [
    {
      name: 'Bluesky',
      icon: BLUESKY_ICON,
      url: props.platforms.bluesky_url,
      eventId: BLUESKY_EVENT_ID,
    },
    {
      name: 'Mastodon',
      icon: MastodonIcon,
      url: props.platforms.mastodon_url,
      eventId: MASTODON_EVENT_ID,
    },
    {
      name: 'LinkedIn',
      icon: LINKEDIN_ICON,
      url: props.platforms.linkedin_url,
      eventId: LINKEDIN_EVENT_ID,
    },
    {
      name: 'Instagram',
      icon: INSTAGRAM_ICON,
      url: props.platforms.instagram_url,
      eventId: INSTAGRAM_EVENT_ID,
    },
    {
      name: 'GitHub',
      icon: GITHUB_ICON,
      url: props.platforms.github_url,
      eventId: GITHUB_EVENT_ID,
    },
    {
      name: 'YouTube',
      icon: YOUTUBE_ICON,
      url: props.platforms.youtube_url,
      eventId: YOUTUBE_EVENT_ID,
    },
    {
      name: 'Website',
      icon: WEBSITE_ICON,
      url: props.platforms.website_url,
      eventId: WEBSITE_EVENT_ID,
    },
    {
      name: 'Twitter',
      icon: TWITTER_ICON,
      url: props.platforms.twitter_url,
      eventId: TWITTER_EVENT_ID,
    },
  ].filter((platform) => platform.url) as {
    name: string
    icon: string
    url: string
    eventId: string
  }[];
});
</script>
