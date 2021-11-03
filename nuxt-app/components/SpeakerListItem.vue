<template>
  <li class="flex md:items-center flex-col md:flex-row-reverse">
    <!-- Event image -->
    <img
      v-if="speaker.event_image"
      class="
        md:w-1/2 md:h-60
        lg:h-80
        xl:h-96
        2xl:h-112
        object-cover
        md:ml-16
        lg:ml-20
      "
      :src="speaker.event_image.url"
      :srcset="imageSrcSet"
      sizes="
          (min-width: 2000px) 696px,
          (min-width: 1536px) 656px,
          (min-width: 768px) 40vw,
          90vw
        "
      loading="lazy"
      :alt="speaker.event_image.alternativeText || fullName"
    />
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
      >
        {{ description }}
      </p>

      <!-- Link -->
      <LinkButton class="mt-6" :href="href">Mehr Infos</LinkButton>
    </div>
  </li>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import removeMarkdown from 'remove-markdown';
import { StrapiSpeaker } from 'shared-code';
import { getImageSrcSet, getFullSpeakerName, getSubpagePath } from '../helpers';
import LinkButton from './LinkButton.vue';

export default defineComponent({
  components: {
    LinkButton,
  },
  props: {
    speaker: {
      type: Object as PropType<StrapiSpeaker>,
      required: true,
    },
  },
  setup(props) {
    // Create image src set
    const imageSrcSet = computed(() =>
      getImageSrcSet(props.speaker.event_image)
    );

    // Create get full name function
    const fullName = computed(() => getFullSpeakerName(props.speaker));

    // Create plain description text
    const description = computed(() =>
      removeMarkdown(props.speaker.description)
    );

    // Create href to speaker's subpage
    const href = computed(() =>
      getSubpagePath('hall-of-fame', fullName.value, props.speaker.id)
    );

    return {
      imageSrcSet,
      fullName,
      description,
      href,
    };
  },
});
</script>
