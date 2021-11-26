<template>
  <div class="w-full h-1/2-screen lg:h-4/6-screen">
    <div class="h-full relative overflow-hidden">
      <div
        class="
          w-full
          h-full
          absolute
          z-10
          top-0
          left-0
          bg-gray-900 bg-opacity-30
        "
      />

      <img
        ref="imageElement"
        class="w-full h-full object-cover"
        :src="coverImage.url"
        :srcset="coverSrcSet"
        sizes="100vw"
        :alt="coverImage.alternativeText || ''"
      />
    </div>
    <ScrollDownMouse />
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  PropType,
  ref,
} from '@nuxtjs/composition-api';
import { StrapiImage } from 'shared-code';
import { useEventListener, useWindow } from '../composables';
import { getImageSrcSet } from '../helpers';
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
    // Create podcast cover element reference
    const imageElement = ref<HTMLImageElement>();

    // Create cover src set
    const coverSrcSet = computed(() => getImageSrcSet(props.coverImage));

    /**
     * It handles the scroll event and adds a
     * parallax effect to the image element.
     */
    const handleScroll = () => {
      imageElement.value!.style.transform = `translateY(${
        window.scrollY * 0.15
      }px)`;
    };

    // Add scroll event listener
    useEventListener(useWindow(), 'scroll', handleScroll);

    return {
      imageElement,
      coverSrcSet,
    };
  },
});
</script>
