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
import { computed } from 'vue'

const props = defineProps<{
    episodeUrl: string
    youtubeUrl: string | null
}>()

const links = computed(() => [
    { label: 'Folge auf programmier.bar', url: props.episodeUrl, missing: '' },
    { label: 'Video auf YouTube', url: props.youtubeUrl, missing: 'Noch keine YouTube-URL hinterlegt.' },
])
</script>
