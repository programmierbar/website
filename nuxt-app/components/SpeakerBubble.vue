<template>
    <div ref="bubbleElement" class="transition-transform duration-500" :class="isFocused && 'scale-110'">
        <div
            class="xs:w-52 2xl:w-112 3xl:w-120 w-44 transition-transform ease-linear sm:w-64 lg:w-80 xl:w-96"
            :class="isFocused ? 'duration-200' : 'duration-400'"
            :style="parallaxStyle"
        >
            <div class="xs:h-52 2xl:h-112 3xl:h-120 h-44 sm:h-64 lg:h-80 xl:h-96">
                <div ref="motionElement" class="h-full scale-150 rounded-full">
                    <div
                        class="scale-65 h-full rounded-full"
                        @mouseenter="() => setIsFocused(true)"
                        @mouseleave="() => setIsFocused(false)"
                    >
                        <NuxtLink
                            class="block h-full rounded-full"
                            :class="`shadow-${color}`"
                            :to="href"
                            data-cursor-more
                        >
                            <!-- https://gist.github.com/ayamflow/b602ab436ac9f05660d9c15190f4fd7b -->
                            <div
                                class="relative h-full overflow-hidden rounded-full"
                                style="-webkit-mask-image: -webkit-radial-gradient(white, black)"
                            >
                                <!-- Profile image -->
                                <DirectusImage
                                    v-if="speaker.profile_image"
                                    class="h-full w-full object-cover"
                                    :image="speaker.profile_image"
                                    :alt="fullName"
                                    sizes="xs:203px sm:250px lg:312px xl:375px 2xl:437px 3xl:468px"
                                    loading="lazy"
                                />

                                <!-- Image overlay -->
                                <div
                                    class="absolute left-0 top-0 h-full w-full rounded-full mix-blend-multiply transition-opacity duration-300"
                                    :class="[
                                        isFocused ? 'opacity-0' : 'opacity-80',
                                        color === 'lime' ? 'bg-lime' : color === 'pink' ? 'bg-pink' : 'bg-blue',
                                    ]"
                                />

                                <!-- Occupation -->
                                <div
                                    class="pointer-events-none absolute bottom-0 left-0 w-full bg-black bg-opacity-80 px-10 pb-5 pt-5 transition-opacity duration-300 md:px-12 md:pb-9 md:pt-7 lg:px-24 lg:pb-14 lg:pt-12"
                                    :class="isFocused ? 'opacity-100' : 'opacity-0'"
                                >
                                    <div
                                        class="xs:text-sm line-clamp-2 text-center text-xs font-light text-white sm:text-base md:line-clamp-none lg:text-lg xl:text-xl 2xl:text-2xl"
                                        style="hyphens: auto"
                                    >
                                        {{ speaker.occupation }}
                                    </div>
                                </div>
                            </div>
                        </NuxtLink>
                    </div>
                </div>
            </div>

            <!-- Name -->
            <h2
                class="xs:text-base mt-6 text-center text-sm font-light italic text-white sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl"
                :class="isFocused && 'font-normal'"
            >
                {{ fullName }}
            </h2>
        </div>
    </div>
</template>

<script lang="ts">
import { getFullSpeakerName } from 'shared-code'
import type { PropType } from 'vue'
import { computed, defineComponent, ref, watch } from 'vue'
import { useEventListener, useMotionParallax, useWindow } from '../composables'
import { START_MAGNET_EFFECT_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'
import type { SpeakerItem } from '../types'
import DirectusImage from './DirectusImage.vue'

export default defineComponent({
    components: {
        DirectusImage,
    },
    props: {
        speaker: {
            type: Object as PropType<
                Pick<
                    SpeakerItem,
                    'slug' | 'academic_title' | 'first_name' | 'last_name' | 'occupation' | 'profile_image'
                >
            >,
            required: true,
        },
        color: {
            type: String as PropType<'lime' | 'pink' | 'blue'>,
            required: true,
        },
    },
    setup(props) {
        // Create bubble and motion element reference
        const bubbleElement = ref<HTMLDivElement>()
        const motionElement = ref<HTMLDivElement>()

        // Create is focused state reference
        const isFocused = ref(false)

        // Use motion parallax
        const motionParallax = useMotionParallax(motionElement)

        // Track analytic event
        watch(
            () => motionParallax.isActive,
            (isActive) => {
                if (isActive) {
                    trackGoal(START_MAGNET_EFFECT_EVENT_ID)
                }
            }
        )

        // Create computed parallax style
        const parallaxStyle = computed(() =>
            motionParallax.isActive
                ? {
                      transform: `translate(${motionParallax.tilt * 80}px, ${motionParallax.roll * 80}px)`,
                  }
                : undefined
        )

        // Create full name
        const fullName = computed(() => getFullSpeakerName(props.speaker))

        // Create href to speaker's subpage
        const href = computed(() => `/hall-of-fame/${props.speaker.slug}`)

        /**
         * It sets the is focused state based of the given parameter.
         *
         * @param nextIsFocused The next is focused state.
         */
        const setIsFocused = (nextIsFocused: boolean) => {
            isFocused.value = nextIsFocused
        }

        /**
         * It handles the scroll event and sets the is focused state on touch
         * devices when the element is in the center of the screen.
         */
        const handleScroll = () => {
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                const { innerHeight, scrollY } = window
                const { offsetTop, clientHeight } = bubbleElement.value!
                isFocused.value =
                    Math.abs(scrollY + innerHeight / 2 - (offsetTop + clientHeight / 2)) <= clientHeight / 2
            }
        }

        // Add scroll event listener to window object
        useEventListener(useWindow(), 'scroll', handleScroll)

        return {
            bubbleElement,
            motionElement,
            isFocused,
            setIsFocused,
            parallaxStyle,
            fullName,
            href,
        }
    },
})
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
