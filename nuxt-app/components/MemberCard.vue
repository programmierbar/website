<template>
  <div>
    <div ref="maskBoxElement" class="w-full relative" style="padding-top: 100%">
      <!-- Background circle -->
      <div
        v-for="i of 2"
        :key="i"
        ref="cursorElements"
        class="
          w-1/3
          h-1/3
          absolute
          left-0
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          overflow-hidden
        "
        :class="[
          i === 1
            ? 'z-10'
            : color === 'lime'
            ? 'bg-lime'
            : color === 'pink'
            ? 'bg-pink'
            : 'bg-blue',
          clipPathIsMoving ? 'top-0' : 'top-1/4 transition-all ease-linear',
          clipPathStartMoving
            ? 'duration-100'
            : !clipPathIsMoving
            ? 'duration-200'
            : '',
        ]"
        :data-cursor-none="i === 1"
        @touchstart.prevent="handleDiscoverEffect"
        @mouseover.prevent="handleDiscoverEffect"
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
        class="w-full absolute top-0 left-0 object-cover"
        :class="[
          !clipPathIsMoving && 'transition-all ease-linear',
          clipPathStartMoving
            ? 'duration-100'
            : !clipPathIsMoving
            ? 'duration-200'
            : '',
        ]"
        :style="{ clipPath: initClipPath }"
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
    <MarkdownToHtml
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
      :markdown="member.description"
    />

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
import { getImageSrcSet, trackGoal } from '../helpers';
import MarkdownToHtml from './MarkdownToHtml.vue';

const initClipPath = 'circle(16.666% at 0 25%)';

export default defineComponent({
  components: {
    MarkdownToHtml,
  },
  props: {
    member: {
      type: Object as PropType<StrapiMember>,
      required: true,
    },
    color: {
      type: String as PropType<'lime' | 'pink' | 'blue'>,
      required: true,
    },
  },
  setup(props) {
    // Create full name
    const fullName = computed(
      () => `${props.member.first_name} ${props.member.last_name}`
    );

    // Create normal and action image src set
    const normalImageSrcSet = computed(() =>
      getImageSrcSet(props.member.normal_image)
    );
    const actionImageSrcSet = computed(() =>
      getImageSrcSet(props.member.action_image)
    );

    // Create element references
    const cursorElements = ref<HTMLDivElement[]>();
    const clipPathElement = ref<HTMLImageElement>();

    // Create state references
    const clipPathIsMoving = ref(false);
    const clipPathStartMoving = ref(false);

    const handleDiscoverEffect = (startEvent: TouchEvent | MouseEvent) => {
      // Track analytic event
      trackGoal(process.env.NUXT_ENV_START_DISCOVER_EFFECT_EVENT!);

      // Detect and create event type
      const isTouch = startEvent.type === 'touchstart';
      const moveEventType = isTouch ? 'touchmove' : 'mousemove';

      // Get initial cursor size
      const cursorSize = {
        width: (startEvent.target as HTMLDivElement).clientWidth,
        height: (startEvent.target as HTMLDivElement).clientHeight,
      };

      /**
       * It handles the move event of the discover effect.
       */
      const handleMoveEvent = (moveEvent: Event) => {
        // Get event position and clip path client rect
        const position = isTouch
          ? (moveEvent as TouchEvent).targetTouches[0]
          : (moveEvent as MouseEvent);
        const clipPath = clipPathElement.value!.getBoundingClientRect();

        // If event position is inside area run discover effect
        if (
          position.clientX > clipPath.left - cursorSize.width / 2 &&
          position.clientX <
            clipPath.left + clipPath.width + cursorSize.width / 2 &&
          position.clientY > clipPath.top - cursorSize.height / 2 &&
          position.clientY <
            clipPath.top + clipPath.height + cursorSize.height / 2
        ) {
          // Update state references
          if (!clipPathIsMoving.value) {
            clipPathIsMoving.value = true;
            clipPathStartMoving.value = true;
            setTimeout(() => {
              clipPathStartMoving.value = false;
            }, 100);
          }

          // Update cursor and clip path position
          const x = position.clientX - clipPath.left;
          const y = position.clientY - clipPath.top;
          clipPathElement.value!.style.clipPath = `circle(41.666% at ${x}px ${y}px)`;
          cursorElements.value?.forEach((element) => {
            element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(2.5)`;
          });

          // Otherwise clean up discover effect
        } else {
          handleCleanUp();
        }
      };

      // Add move event listener to start event target
      startEvent.target!.addEventListener(moveEventType, handleMoveEvent);

      /**
       * It handles the clean up of the discover effect.
       */
      const handleCleanUp = () => {
        // Remove event listeners
        startEvent.target!.removeEventListener(moveEventType, handleMoveEvent);
        if (isTouch) {
          startEvent.target!.removeEventListener('touchend', handleCleanUp);
        } else {
          window.removeEventListener('scroll', handleCleanUp);
        }

        // Clean up state reference
        clipPathIsMoving.value = false;

        // Clean up cursor and clip path position
        clipPathElement.value!.style.clipPath = initClipPath;
        cursorElements.value?.forEach(
          (element) => (element.style.transform = '')
        );
      };

      // Add clean up event listener
      if (isTouch) {
        startEvent.target!.addEventListener('touchend', handleCleanUp);
      } else {
        window.addEventListener('scroll', handleCleanUp);
      }
    };

    return {
      fullName,
      normalImageSrcSet,
      actionImageSrcSet,
      cursorElements,
      initClipPath,
      clipPathElement,
      clipPathIsMoving,
      clipPathStartMoving,
      handleDiscoverEffect,
    };
  },
});
</script>
