<template>
    <div class="h-1/2-screen w-full lg:h-4/6-screen">
        <div class="relative h-full overflow-hidden">
            <div v-if='shadow' class="absolute left-0 bottom-0 z-10 h-1/3 w-full shadow"/>
            <div v-if='overlay' class="absolute left-0 top-0 z-10 h-full w-full bg-gray-900 bg-opacity-30" />

            <DirectusImage
                ref="imageComponent"
                class="h-full w-full object-cover"
                :image="coverImage"
                sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw 3xl:100vw"
            />
        </div>
        <ScrollDownMouse />
    </div>
</template>

<script lang="ts">
import type { ComponentInstance, PropType } from 'vue'
import { defineComponent, ref } from 'vue'
import { useEventListener, useWindow } from '../composables'
import type { FileItem } from '../types'
import DirectusImage from './DirectusImage.vue'
import ScrollDownMouse from './ScrollDownMouse.vue'

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
      shadow: {
        type: Boolean,
        required: false,
        default: true,
      },
      overlay: {
        type: Boolean,
        required: false,
        default: true,
      },
    },
    setup() {
        // Create image component reference
        const imageComponent = ref<ComponentInstance>()

        /**
         * It handles the scroll event and adds a
         * parallax effect to the image element.
         */
        const handleScroll = () => {
            ;(imageComponent.value!.$el as HTMLImageElement).style.transform = `translateY(${window.scrollY * 0.15}px)`
        }

        // Add scroll event listener
        useEventListener(useWindow(), 'scroll', handleScroll)

        return {
            imageComponent,
        }
    },
})
</script>

<style scoped>
.shadow {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.00) 0%, #000 100%);
}
</style>
