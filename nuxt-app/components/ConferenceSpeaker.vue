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
    <div class='mt-6 p-9 flex flex-col min-h-120 max-h-120 flex-shrink-0' :class="[isExpanded ? 'max-h-full' : '']" @click='isExpanded = !isExpanded'>
      <div>
        <p class='font-black text-3xl mb-2'>{{ fullName }}</p>
        <p class='font-light text-xl italic'>{{ speaker.occupation }}</p>
      </div>
      <div
        class='relative'
        :class="['transition-all duration-300', !isExpanded ? 'overflow-hidden' : '']"
        :data-cursor-more="isExpanded ? null : true"
        :data-cursor-hover="!isExpanded ? null : true"
      >
          <InnerHtml
            class='mt-7 font-light text-xl'
            :html='speaker.description'
          />
        <div
          v-if='!isExpanded'
          class='absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#131415] to-transparent'
        ></div>
      </div>
      <IndividualPlatforms :platforms='platforms' :scope='"speaker"'/>
    </div>
  </div>
</template>

<script setup lang='ts'>
import type { SpeakerPreviewItem } from '~/types';
import { computed, ref } from 'vue';
import { getFullSpeakerName } from 'shared-code';

const props = defineProps<{
  speaker: SpeakerPreviewItem;
}>();

const isExpanded = ref(false);

const fullName = computed(() => getFullSpeakerName(props.speaker));

// Create platform list
const platforms = computed(() => {
    return {
      github_url: props.speaker.github_url,
      twitter_url: props.speaker.twitter_url,
      bluesky_url: props.speaker.bluesky_url,
      linkedin_url: props.speaker.linkedin_url,
      instagram_url: props.speaker.instagram_url,
      youtube_url: props.speaker.youtube_url,
      website_url: props.speaker.website_url,
    }
  });
</script>

<style scoped>
.speaker-box {
  background: var(--Grey, #131415);
}
</style>
