<template>
  <div
    class="transition-transform duration-500"
    :class="isFocused && 'scale-110'"
  >
    <div
      class="
        w-44
        xs:w-52
        sm:w-64
        lg:w-80
        xl:w-96
        2xl:w-112
        3xl:w-120
        transition-transform
        ease-linear
      "
      :class="isFocused ? 'duration-200' : 'duration-400'"
      :style="parallaxStyle"
    >
      <div class="h-44 xs:h-52 sm:h-64 lg:h-80 xl:h-96 2xl:h-112 3xl:h-120">
        <div ref="motionElement" class="h-full scale-150 rounded-full">
          <div
            class="h-full scale-65 rounded-full"
            @mouseenter="() => changeIsFocused(true)"
            @mouseleave="() => changeIsFocused(false)"
          >
            <NuxtLink
              class="h-full relative block rounded-full overflow-hidden"
              :class="`shadow-${color}`"
              :to="`/hall-of-fame/${speaker.id}?color=${color}`"
              data-cursor-more
            >
              <!-- Profile image -->
              <img
                class="w-full h-full object-cover"
                :src="speaker.profile_image.url"
                :srcset="profileImageSrcSet"
                sizes="
                  (min-width: 2000px) 468px,
                  (min-width: 1536px) 437px,
                  (min-width: 1280px) 375px,
                  (min-width: 1024px) 312px,
                  (min-width: 640px) 250px,
                  (min-width: 520px) 203px,
                  172px
                "
                loading="lazy"
                :alt="speaker.profile_image.alternativeText || fullName"
              />

              <!-- Image overlay -->
              <div
                class="
                  w-full
                  h-full
                  absolute
                  top-0
                  left-0
                  rounded-full
                  mix-blend-multiply
                  transition-opacity
                  duration-300
                "
                :class="[
                  isFocused ? 'opacity-0' : 'opacity-80',
                  color === 'lime'
                    ? 'bg-lime'
                    : color === 'pink'
                    ? 'bg-pink'
                    : 'bg-blue',
                ]"
              />

              <!-- Occupation -->
              <div
                class="
                  w-full
                  absolute
                  left-0
                  bottom-0
                  bg-black bg-opacity-80
                  text-xs
                  xs:text-sm
                  sm:text-base
                  lg:text-lg
                  xl:text-xl
                  2xl:text-2xl
                  text-white
                  font-light
                  text-center
                  px-10
                  pt-5
                  pb-7
                  md:px-12 md:pt-7 md:pb-9
                  lg:px-16 lg:pt-12 lg:pb-16
                  transition-opacity
                  duration-300
                  pointer-events-none
                "
                :class="isFocused ? 'opacity-100' : 'opacity-0'"
              >
                {{ speaker.occupation }}
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Name -->
      <h2
        class="
          text-sm
          xs:text-base
          sm:text-lg
          lg:text-xl
          xl:text-2xl
          2xl:text-3xl
          text-white text-center
          font-light
          italic
          mt-6
        "
        :class="isFocused && 'font-normal'"
      >
        {{ fullName }}
      </h2>
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
import { StrapiSpeaker } from 'shared-code';
import { useMotionParallax, useImageSrcSet } from '../composables';

export default defineComponent({
  props: {
    speaker: {
      type: Object as PropType<StrapiSpeaker>,
      required: true,
    },
    color: {
      type: String as PropType<'lime' | 'pink' | 'blue'>,
      required: true,
    },
  },
  setup(props) {
    // Create is focused state reference
    const isFocused = ref(false);

    /**
     * It changes the is focused state based of the given parameter.
     *
     * @param nextIsFocused The next is focused state.
     */
    const changeIsFocused = (nextIsFocused: boolean) => {
      isFocused.value = nextIsFocused;
    };

    // Create motion element an parallax reference
    const motionElement = ref<HTMLDivElement>();
    const motionParallax = useMotionParallax(motionElement);

    // Create computed parallax style
    const parallaxStyle = computed(() =>
      motionParallax.isActive
        ? {
            transform: `translate(${motionParallax.tilt * 80}px, ${
              motionParallax.roll * 80
            }px)`,
          }
        : undefined
    );

    // Create full name
    const fullName = computed(() =>
      `${props.speaker.academic_title || ''} ${props.speaker.first_name} ${
        props.speaker.last_name
      }`.trim()
    );

    // Create profile image src set
    const profileImageSrcSet = useImageSrcSet(props.speaker.profile_image);

    return {
      isFocused,
      changeIsFocused,
      motionElement,
      parallaxStyle,
      fullName,
      profileImageSrcSet,
    };
  },
});
</script>

<style lang="postcss" scoped>
.shadow-lime {
  box-shadow: 0 0 40px theme('colors.lime.500');
}
.shadow-pink {
  box-shadow: 0 0 40px theme('colors.pink.500');
}
.shadow-blue {
  box-shadow: 0 0 40px theme('colors.blue.500');
}
@media (min-width: 768px) {
  .shadow-lime {
    box-shadow: 0 0 55px theme('colors.lime.500');
  }
  .shadow-pink {
    box-shadow: 0 0 55px theme('colors.pink.500');
  }
  .shadow-blue {
    box-shadow: 0 0 55px theme('colors.blue.500');
  }
}
@media (min-width: 1280px) {
  .shadow-lime {
    box-shadow: 0 0 70px theme('colors.lime.500');
  }
  .shadow-pink {
    box-shadow: 0 0 70px theme('colors.pink.500');
  }
  .shadow-blue {
    box-shadow: 0 0 70px theme('colors.blue.500');
  }
}
</style>
