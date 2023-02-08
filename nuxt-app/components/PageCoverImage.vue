<template>
  <div class="w-full h-1/2-screen lg:h-4/6-screen">
    <div class="h-full relative overflow-hidden">
      <div
        class="w-full h-full absolute z-10 top-0 left-0 bg-gray-900 bg-opacity-30"
      />

      <DirectusImage
        ref="imageComponent"
        class="w-full h-full object-cover"
        :image="coverImage"
        sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw 3xl:100vw"
      />
    </div>
    <ScrollDownMouse />
  </div>
</template>

<script lang="ts">
import { ComponentInstance, defineComponent, PropType, ref } from 'vue';
import { useEventListener, useWindow } from '../composables';
import { FileItem } from '../types';
import DirectusImage from './DirectusImage.vue';
import ScrollDownMouse from './ScrollDownMouse.vue';

export default defineComponent({
  components: {
    DirectusImage,
    ScrollDownMouse,
  },
  props: {
    coverImage: {
      type: Object as PropType<FileItem>,
      required: true,
    },
  },
  setup() {
    // Create image component reference
    const imageComponent = ref<ComponentInstance>();

    /**
     * It handles the scroll event and adds a
     * parallax effect to the image element.
     */
    const handleScroll = () => {
      (
        imageComponent.value!.$el as HTMLImageElement
      ).style.transform = `translateY(${window.scrollY * 0.15}px)`;
    };

    // Add scroll event listener
    useEventListener(useWindow(), 'scroll', handleScroll);

    return {
      imageComponent,
    };
  },
});
</script>
