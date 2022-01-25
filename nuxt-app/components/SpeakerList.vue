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
import { SpeakerItem } from '../types';
import SpeakerListItem from './SpeakerListItem.vue';

export default defineComponent({
  components: {
    SpeakerListItem,
  },
  props: {
    speakers: {
      type: Array as PropType<
        Pick<
          SpeakerItem,
          | 'id'
          | 'slug'
          | 'academic_title'
          | 'first_name'
          | 'last_name'
          | 'description'
          | 'event_image'
        >[]
      >,
      required: true,
    },
  },
});
</script>
