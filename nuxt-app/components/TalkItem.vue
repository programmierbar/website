<template>
  <p class='text-4xl font-black'>{{ talk.title }}</p>
  <p class='text-2xl italic font-light mb-6'>{{ buildSpeakerNamesForTalk(talk) }}</p>
  <div class='flex flex-col md:flex-row gap-10'>
    <div class='basis-full md:basis-1/2 order-2 md:order-1'>
      <InnerHtml
        :html='talk.abstract'
        class='font-light text-2xl'
      />
    </div>
    <div class='basis-full md:basis-1/2 order-1 md:order-2'>
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
