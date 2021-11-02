<template>
  <ul class="space-y-14 md:space-y-24">
    <SpeakerListItem
      v-for="speaker of speakers"
      :key="speaker.id"
      :speaker="speaker"
    />
  </ul>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiSpeaker } from 'shared-code';
import SpeakerListItem from './SpeakerListItem.vue';

export default defineComponent({
  components: {
    SpeakerListItem,
  },
  props: {
    speakers: {
      type: Array as PropType<StrapiSpeaker[]>,
      required: true,
    },
  },
});
</script>
