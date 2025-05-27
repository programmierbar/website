<template>
  <div class="
        flex flex-col
        lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr]
    ">
    <div class="
            order-1 <!-- Mobile order -->
            lg:order-none <!-- Reset order for grid -->
            lg:col-start-1 lg:row-start-1 <!-- Desktop grid placement -->
        ">
      <p class='text-3xl font-black mb-2'>{{ talk.title }}</p>
      <p class='text-xl italic font-light lg:mb-7'>{{ buildSpeakerNamesForTalk(talk) }}</p>
    </div>

    <div class="
            order-3 <!-- Mobile order -->
            lg:order-none <!-- Reset order for grid -->
            lg:col-start-1 lg:row-start-2 <!-- Desktop grid placement -->
            md:mt-0 sm:mt-5
        ">
      <InnerHtml
        :html='talk.abstract'
        class='font-light text-xl'
      />
    </div>

    <div class="
            order-2 <!-- Mobile order -->
            lg:order-none <!-- Reset order for grid -->
            lg:col-start-2 lg:row-start-1 lg:row-span-2 <!-- Desktop grid placement & span -->
            pl-0 lg:pl-10
            mb-5 lg:mb-0
        ">
      <EmbeddedVideoPlayer v-if='talk.video_url' :url='talk.video_url'/>
      <DirectusImage
        v-if='!talk.video_url && talk.thumbnail'
        class='object-cover aspect-video w-full'
        :image='talk.thumbnail'
        sizes='lg:600px'
        loading='lazy'
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TalkItem } from '~/types';
import { getFullSpeakerName } from 'shared-code';

const props = defineProps<{
  talk: TalkItem
}>();

const buildSpeakerNamesForTalk = function(talk: TalkItem): string {
  let result = 'mit ';

  const speakers: string[] = [];

  talk.speakers.forEach((speaker) => {
    speakers.push(getFullSpeakerName(speaker.speaker));
  });

  talk.members.forEach((member) => {
    speakers.push(`${member.member.first_name} ${member.member.last_name}`);
  });

  if (speakers.length === 0) {
    return '';
  }

  return result + speakers.join(' & ');
};
</script>

<style lang="postcss" scoped>
</style>
