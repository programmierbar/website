<template>
  <div class="w-full h-1/2-screen lg:h-4/6-screen relative">
    <div
      class="w-full h-full absolute top-0 left-0 bg-gray-900 bg-opacity-30"
    />
    <img
      class="w-full h-full object-cover"
      :src="coverImage.url"
      :srcset="coverSrcSet"
      sizes="100vw"
      :alt="coverImage.alternativeText || ''"
    />
    <ScrollDownMouse class="relative -top-9 lg:-top-14" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiImage } from 'shared-code';
import { useImageSrcSet } from '../composables';
import ScrollDownMouse from './ScrollDownMouse.vue';

export default defineComponent({
  components: {
    ScrollDownMouse,
  },
  props: {
    coverImage: {
      type: Object as PropType<StrapiImage>,
      required: true,
    },
  },
  setup(props) {
    // Create cover src set
    const coverSrcSet = useImageSrcSet(props.coverImage);

    return {
      coverSrcSet,
    };
  },
});
</script>
