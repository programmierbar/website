<template>
  <div>
    <div
      ref="maskBoxElement"
      class="w-full relative"
      style="padding-top: 100%"
      data-cursor-none
    >
      <!-- Background circle -->
      <div
        ref="cursorElement"
        class="
          w-2/5
          h-2/5
          absolute
          left-0
          origin-top-left
          pointer-events-none
          before:w-full
          before:h-full
          before:absolute
          before:bg-lime-200
          before:rounded-full
          before:-translate-x-1/2
          before:-translate-y-1/2
        "
        :class="
          !clipPathIsMoving ? 'top-1/2 transition-all duration-300' : 'top-0'
        "
      />

      <!-- Normal image -->
      <img
        class="w-full absolute top-0 left-0 object-cover pointer-events-none"
        :src="member.normal_image.url"
        :srcset="normalImageSrcSet"
        sizes="
          (min-width: 1536px) 589px,
          (min-width: 1280px) 487px,
          (min-width: 1024px) 384px,
          (min-width: 768px) 288px,
          90vw
        "
        loading="lazy"
        :alt="member.normal_image.alternativeText || fullName"
      />

      <!-- Action image -->
      <img
        ref="clipPathElement"
        class="w-full absolute top-0 left-0 object-cover pointer-events-none"
        :class="!clipPathIsMoving && 'transition-all duration-300'"
        style="clip-path: circle(20% at 0 50%)"
        :src="member.action_image.url"
        :srcset="actionImageSrcSet"
        sizes="
          (min-width: 1536px) 589px,
          (min-width: 1280px) 487px,
          (min-width: 1024px) 384px,
          (min-width: 768px) 288px,
          90vw
        "
        loading="lazy"
        :alt="member.normal_image.alternativeText || fullName"
      />
    </div>

    <!-- Full name -->
    <h2
      class="
        text-xl
        md:text-2xl
        lg:text-3xl
        text-white
        font-black
        mt-10
        md:mt-12
        lg:mt-16
      "
    >
      {{ fullName }}
    </h2>

    <!-- Description -->
    <p
      class="
        text-lg
        md:text-xl
        lg:text-2xl
        text-white
        font-light
        leading-normal
        whitespace-pre-line
        mt-5
        md:mt-6
        lg:mt-8
      "
    >
      <span>{{ member.description }}</span>
    </p>

    <!-- Occupation -->
    <div
      class="
        text-base
        md:text-lg
        lg:text-xl
        text-white
        font-bold
        uppercase
        mt-6
        md:mt-7
        lg:mt-10
      "
    >
      {{ member.occupation }}
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  PropType,
  ref,
} from '@nuxtjs/composition-api';
import { StrapiMember } from 'shared-code';
import { useEventListener, useImageSrcSet } from '../composables';

export default defineComponent({
  props: {
    member: {
      type: Object as PropType<StrapiMember>,
      required: true,
    },
  },
  setup(props) {
    // Create full name
    const fullName = computed(
      () => `${props.member.first_name} ${props.member.last_name}`
    );

    // Create normal image src set
    const normalImageSrcSet = useImageSrcSet(props.member.normal_image);

    // Create action image src set
    const actionImageSrcSet = useImageSrcSet(props.member.action_image);

    // Create element and state references
    const maskBoxElement = ref<HTMLDivElement>();
    const cursorElement = ref<HTMLDivElement>();
    const clipPathElement = ref<HTMLImageElement>();
    const clipPathIsMoving = ref(false);

    /**
     * It moves the cursor and the clip path so that the user
     * can playfully discover the action image via mouse.
     */
    const moveCursorAndClipPath = (event: MouseEvent) => {
      clipPathIsMoving.value = true;
      const { top, left } = maskBoxElement.value!.getBoundingClientRect();
      const x = event.clientX - left;
      const y = event.clientY - top;
      cursorElement.value!.style.transform = `translate(${x}px, ${y}px) scale(1.5)`;
      clipPathElement.value!.style.clipPath = `circle(30% at ${x}px ${y}px)`;
    };

    /**
     * It resets the position of the cursor and the clip path
     * as soon as the user's mouse leaves the image.
     */
    const resetCursorAndClipPath = () => {
      clipPathIsMoving.value = false;
      cursorElement.value!.style.transform = '';
      clipPathElement.value!.style.clipPath = `circle(20% at 0 50%)`;
    };

    // Add mousemove and mouseleave event listeners
    useEventListener(maskBoxElement, 'mousemove', moveCursorAndClipPath);
    useEventListener(maskBoxElement, 'mouseleave', resetCursorAndClipPath);

    return {
      fullName,
      normalImageSrcSet,
      actionImageSrcSet,
      maskBoxElement,
      cursorElement,
      clipPathElement,
      clipPathIsMoving,
    };
  },
});
</script>
