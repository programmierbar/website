<template>
    <ul class="flex space-x-5">
        <li v-for="socialNetwork in socialNetworks" :key="socialNetwork.href" class="h-6">
            <a
                class="block h-full text-white hover:text-lime"
                :href="socialNetwork.href"
                target="_blank"
                rel="noreferrer"
                data-cursor-hover
                @click="() => trackGoal(socialNetwork.eventId)"
                v-html="socialNetwork.icon"
            ></a>
        </li>
        <li style="display: none">
            <!-- Only required for mastodon verification -->
            <a rel="me" href="https://social.programmier.bar/@podcast">Mastodon</a>
        </li>
    </ul>
</template>

<script setup lang="ts">
import githubIcon from '~/assets/logos/github.svg?raw'
import instagramIcon from '~/assets/logos/instagram.svg?raw'
import linkedinIcon from '~/assets/logos/linkedin.svg?raw'
import mastodonIcon from '~/assets/logos/mastodon.svg?raw'
import twitterIcon from '~/assets/logos/twitter.svg?raw'
import youtubeIcon from '~/assets/logos/youtube.svg?raw'
import {
    OPEN_GITHUB_EVENT_ID,
    OPEN_INSTAGRAM_EVENT_ID,
    OPEN_LINKEDIN_EVENT_ID,
    OPEN_MASTODON_EVENT_ID,
    OPEN_TWITTER_EVENT_ID,
    OPEN_YOUTUBE_EVENT_ID,
} from '../config'
import { trackGoal } from '../helpers'

const socialNetworks = [
    {
        label: 'Mastodon',
        icon: mastodonIcon,
        href: 'https://social.programmier.bar/@podcast',
        eventId: OPEN_MASTODON_EVENT_ID,
    },
    {
        label: 'GitHub',
        icon: githubIcon,
        href: 'https://github.com/programmierbar',
        eventId: OPEN_GITHUB_EVENT_ID,
    },
    {
        label: 'LinkedIn',
        icon: linkedinIcon,
        href: 'https://www.linkedin.com/company/68164372',
        eventId: OPEN_LINKEDIN_EVENT_ID,
    },
    {
        label: 'YouTube',
        icon: youtubeIcon,
        href: 'https://www.youtube.com/channel/UCi9Odm-45QGUBRs5KiF1-HQ',
        eventId: OPEN_YOUTUBE_EVENT_ID,
    },
    {
        label: 'Instagram',
        icon: instagramIcon,
        href: 'https://www.instagram.com/programmier.bar',
        eventId: OPEN_INSTAGRAM_EVENT_ID,
    },
    {
        label: 'Twitter',
        icon: twitterIcon,
        href: 'https://twitter.com/programmierbar',
        eventId: OPEN_TWITTER_EVENT_ID,
    },
]
</script>
