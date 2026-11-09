<template>
    <dl class="space-y-6">
        <div v-for="link of links" :key="link.label">
            <dt class="text-sm font-black uppercase tracking-widest text-lime md:text-base">{{ link.label }}</dt>
            <dd class="mt-2">
                <!-- The URL itself is the content here, so it is shown in full rather than as link text -->
                <a
                    v-if="link.url"
                    class="break-all text-base font-light text-white underline decoration-lime underline-offset-4 transition-colors hover:text-lime md:text-xl"
                    :href="link.url"
                    target="_blank"
                    rel="noreferrer"
                    data-cursor-hover
                >
                    {{ link.url }}
                </a>
                <HeiseMissingValue v-else>{{ link.missing }}</HeiseMissingValue>
            </dd>
        </div>
    </dl>
</template>

<script setup lang="ts">
import { normalizeExternalUrl } from '~/helpers'
import { computed } from 'vue'

const props = defineProps<{
    episodeUrl: string
    youtubeUrl: string | null
}>()

// `web`, not `youtube`: the field holds a video link, and the `youtube` rules would read a bare value
// as a channel handle. A value that cannot be made into a URL is named, so editors can fix it.
const youtubeUrl = computed(() => normalizeExternalUrl(props.youtubeUrl, 'web'))

const links = computed(() => [
    { label: 'Folge auf programmier.bar', url: props.episodeUrl, missing: '' },
    {
        label: 'Video auf YouTube',
        url: youtubeUrl.value,
        missing: props.youtubeUrl?.trim()
            ? `Die YouTube-URL im CMS ist ungültig: ${props.youtubeUrl}`
            : 'Noch keine YouTube-URL hinterlegt.',
    },
])
</script>
