<template>
  <li class="flex md:items-center flex-col md:flex-row-reverse">
    <!-- Event image -->
    <NuxtLink
      class="md:w-1/2 md:h-60 lg:h-80 xl:h-96 2xl:h-112 block md:ml-16 lg:ml-20"
      :to="href"
      data-cursor-hover
    >
      <DirectusImage
        v-if="speaker.event_image"
        class="w-full h-full object-cover"
        :image="speaker.event_image"
        :alt="fullName"
        sizes="xs:90vw sm:90vw md:40vw lg:40vw xl:40vw 2xl:656px 3xl:696px"
        loading="lazy"
      />
    </NuxtLink>

    <div class="md:w-1/2 mt-10 md:mt-0">
      <!-- Name -->
      <h3 class="text-xl md:text-2xl lg:text-3xl text-white font-black">
        {{ fullName }}
      </h3>

      <!-- Description -->
      <p
        class="
          text-base
          md:text-xl
          lg:text-2xl
          text-white
          font-light
          leading-normal
          line-clamp-4
          space-y-8
          mt-5
          md:mt-10
        "
        v-html="description"
      />

      <!-- Link -->
      <LinkButton class="mt-6" :href="href">Mehr Infos</LinkButton>
    </div>
  </li>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { getFullSpeakerName } from 'shared-code';
import { SpeakerItem } from '../types';
import DirectusImage from './DirectusImage.vue';
import LinkButton from './LinkButton.vue';

export default defineComponent({
  components: {
    DirectusImage,
    LinkButton,
  },
  props: {
    speaker: {
      type: Object as PropType<
        Pick<
          SpeakerItem,
          | 'slug'
          | 'academic_title'
          | 'first_name'
          | 'last_name'
          | 'description'
          | 'event_image'
        >
      >,
      required: true,
    },
  },
  setup(props) {
    // Create get full name function
    const fullName = computed(() => getFullSpeakerName(props.speaker));

    // Create plain description text
    const description = computed(() =>
      props.speaker.description.replace(/<[^<>]+>/g, '')
    );

    // Create href to speaker's subpage
    const href = computed(() => `/hall-of-fame/${props.speaker.slug}`);

    return {
      fullName,
      description,
      href,
    };
  },
});
</script>
