<template>
    <ul class="flex space-x-5">
        <li v-for="socialNetwork in socialNetworks" :key="socialNetwork.href" class="h-6">
            <a
                class="mr-2 block h-full text-white hover:text-lime"
                :href="socialNetwork.href"
                target="_blank"
                rel="noreferrer"
                data-cursor-hover
                @click="() => trackGoal(socialNetwork.eventId)"
            >
                <component :is="socialNetwork.icon" class="lg:mt-1.5" />
            </a>
        </li>
        <li style="display: none">
            <!-- Only required for mastodon verification -->
            <a rel="me" href="https://social.programmier.bar/@podcast">Mastodon</a>
        </li>
    </ul>
</template>

<script setup lang="ts">
import BlueskyIcon from '~/assets/logos/bluesky.svg'
import GithubIcon from '~/assets/logos/github.svg'
import InstagramIcon from '~/assets/logos/instagram.svg'
import LinkedinIcon from '~/assets/logos/linkedin.svg'
import MastodonIcon from '~/assets/logos/mastodon.svg'
import DiscordIcon from '~/assets/logos/discord.svg'
//import TwitterIcon from '~/assets/logos/twitter.svg'
import YoutubeIcon from '~/assets/logos/youtube.svg'
import {
  DISCORD_INVITE_LINK,
  OPEN_BLUESKY_EVENT_ID,
  OPEN_GITHUB_EVENT_ID,
  OPEN_INSTAGRAM_EVENT_ID,
  OPEN_LINKEDIN_EVENT_ID,
  OPEN_MASTODON_EVENT_ID,
  //OPEN_TWITTER_EVENT_ID,
  OPEN_DISCORD_EVENT_ID,
  OPEN_YOUTUBE_EVENT_ID,
} from '../config';
import { trackGoal } from '../helpers'

const socialNetworks = [
    {
        label: 'Mastodon',
        icon: MastodonIcon,
        href: 'https://social.programmier.bar/@podcast',
        eventId: OPEN_MASTODON_EVENT_ID,
    },
    {
        label: 'GitHub',
        icon: GithubIcon,
        href: 'https://github.com/programmierbar',
        eventId: OPEN_GITHUB_EVENT_ID,
    },
    {
        label: 'LinkedIn',
        icon: LinkedinIcon,
        href: 'https://www.linkedin.com/company/68164372',
        eventId: OPEN_LINKEDIN_EVENT_ID,
    },
    {
      label: 'Bluesky',
      icon: BlueskyIcon,
      href: 'https://bsky.app/profile/programmier.bar',
      eventId: OPEN_BLUESKY_EVENT_ID,
    },
    {
      label: 'Instagram',
      icon: InstagramIcon,
      href: 'https://www.instagram.com/programmier.bar',
      eventId: OPEN_INSTAGRAM_EVENT_ID,
    },
    {
      label: 'Discord',
      icon: DiscordIcon,
      href: DISCORD_INVITE_LINK,
      eventId: OPEN_DISCORD_EVENT_ID,
    },
    {
        label: 'YouTube',
        icon: YoutubeIcon,
        href: 'https://www.youtube.com/channel/UCi9Odm-45QGUBRs5KiF1-HQ',
        eventId: OPEN_YOUTUBE_EVENT_ID,
    },
//    {
//        label: 'Twitter',
//        icon: TwitterIcon,
//        href: 'https://twitter.com/programmierbar',
//        eventId: OPEN_TWITTER_EVENT_ID,
//    },
]
</script>
