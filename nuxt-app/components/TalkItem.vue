<template>
    <div :id="'talk-' + talk.id" class="flex flex-col lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        <div
            class="<!-- Mobile order --> <!-- Reset order for --> <!-- Desktop placement --> order-1 grid grid lg:order-none lg:col-start-1 lg:row-start-1"
        >
            <p class="mb-2 text-3xl font-black">{{ talk.title }}</p>
            <p class="text-xl font-light italic lg:mb-7">{{ buildSpeakerNamesForTalk(talk) }}</p>
        </div>

        <div
            :class="[
                'order-3 sm:mt-5 md:mt-0 lg:order-none',
                !talk.video_url && !talk.thumbnail ? 'lg:col-span-2' : 'lg:col-start-1 lg:row-start-2',
            ]"
        >
            <InnerHtml :html="talk.abstract" class="space-y-8 text-xl font-light" />
        </div>

        <div
            class="<!-- Mobile order --> <!-- Reset order for --> <!-- Desktop placement & span --> order-2 mb-5 grid grid pl-0 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mb-0 lg:pl-10"
        >
            <EmbeddedVideoPlayer v-if="talk.video_url" :url="talk.video_url" />
            <DirectusImage
                v-if="!talk.video_url && talk.thumbnail"
                class="aspect-video w-full object-cover"
                :image="talk.thumbnail"
                sizes="lg:600px"
                loading="lazy"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { buildSpeakerNamesForTalk } from '~/helpers/buildSpeakerNamesForTalk'
import type { TalkItem } from '~/types'

const props = defineProps<{
    talk: TalkItem
}>()
</script>

<style lang="postcss" scoped></style>
