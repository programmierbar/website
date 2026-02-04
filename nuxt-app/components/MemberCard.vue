<template>
    <div>
        <div ref="maskBoxElement" class="relative w-full" style="padding-top: 100%">
            <!-- Background circle -->
            <div
                v-for="i of 2"
                :key="i"
                ref="cursorElements"
                class="absolute left-0 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
                :class="[
                    i === 1 ? 'z-10' : color === 'lime' ? 'bg-lime' : color === 'pink' ? 'bg-pink' : 'bg-blue',
                    clipPathIsMoving ? 'top-0' : 'top-1/4 transition-all ease-linear',
                    clipPathStartMoving ? 'duration-100' : !clipPathIsMoving ? 'duration-200' : '',
                ]"
                :data-cursor-none="i === 1"
                @touchstart.prevent="handleDiscoverEffect"
                @mouseover.prevent="handleDiscoverEffect"
            />

            <!-- Normal image -->
            <DirectusImage
                class="pointer-events-none absolute left-0 top-0 w-full object-cover"
                :image="member.normal_image"
                :alt="fullName"
                sizes="xs:90vw sm:90vw md:288px lg:384px xl:487px 2xl:589px"
                loading="lazy"
            />

            <!-- Action image -->
            <DirectusImage
                ref="clipPathComponent"
                class="absolute left-0 top-0 w-full object-cover"
                :class="[
                    !clipPathIsMoving && 'transition-all ease-linear',
                    clipPathStartMoving ? 'duration-100' : !clipPathIsMoving ? 'duration-200' : '',
                ]"
                :style="{ clipPath: initClipPath }"
                :image="member.action_image"
                :alt="fullName"
                sizes="xs:90vw sm:90vw md:288px lg:384px xl:487px 2xl:589px"
                loading="lazy"
            />
        </div>

        <!-- Full name -->
        <h2 class="mt-10 text-xl font-black text-white md:mt-12 md:text-2xl lg:mt-16 lg:text-3xl">
            {{ fullName }}
        </h2>

        <!-- Description -->
        <InnerHtml
            class="mt-5 whitespace-pre-line text-lg font-light leading-normal text-white md:mt-6 md:text-xl lg:mt-8 lg:text-2xl"
            :html="member.description"
        />

        <!-- Occupation -->
        <div class="mt-6 text-base font-bold uppercase text-white md:mt-7 md:text-lg lg:mt-10 lg:text-xl">
            {{ member.occupation }}
        </div>

        <IndividualPlatforms :platforms='platforms' :scope='"member"'/>
    </div>
</template>

<script lang="ts">
import type { ComponentInstance, PropType } from 'vue'
import { computed, defineComponent, ref } from 'vue'
import { DIRECTUS_CMS_URL, START_DISCOVER_EFFECT_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'
import type { MemberItem } from '../types'
import DirectusImage from './DirectusImage.vue'
import InnerHtml from './InnerHtml.vue'

const initClipPath = 'circle(16.666% at 0 25%)'

export default defineComponent({
    components: {
        DirectusImage,
        InnerHtml,
    },
    props: {
        member: {
            type: Object as PropType<
                Pick<
                    MemberItem,
                    | 'first_name'
                    | 'last_name'
                    | 'task_area'
                    | 'occupation'
                    | 'description'
                    | 'normal_image'
                    | 'action_image'
                    | 'twitter_url'
                    | 'bluesky_url'
                    | 'linkedin_url'
                    | 'instagram_url'
                    | 'github_url'
                    | 'youtube_url'
                    | 'website_url'
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
        // Create full name
        const fullName = computed(() => `${props.member.first_name} ${props.member.last_name}`)
        const platforms = computed(() => {
          if (!props.member) {
            return {}
          }

          return {
            github_url: props.member.github_url,
            twitter_url: props.member.twitter_url,
            bluesky_url: props.member.bluesky_url,
            linkedin_url: props.member.linkedin_url,
            instagram_url: props.member.instagram_url,
            youtube_url: props.member.youtube_url,
            website_url: props.member.website_url,
          }
        })

        // Create element references
        const cursorElements = ref<HTMLDivElement[]>()
        const clipPathComponent = ref<ComponentInstance>()

        // Create state references
        const clipPathIsMoving = ref(false)
        const clipPathStartMoving = ref(false)

        const handleDiscoverEffect = (startEvent: TouchEvent | MouseEvent) => {
            // Track analytic event
            trackGoal(START_DISCOVER_EFFECT_EVENT_ID)

            // Detect and create event type
            const isTouch = startEvent.type === 'touchstart'
            const moveEventType = isTouch ? 'touchmove' : 'mousemove'

            // Get initial cursor size
            const cursorSize = {
                width: (startEvent.target as HTMLDivElement).clientWidth,
                height: (startEvent.target as HTMLDivElement).clientHeight,
            }

            /**
             * It handles the move event of the discover effect.
             */
            const handleMoveEvent = (moveEvent: Event) => {
                // Get event position and clip path client rect
                const position = isTouch ? (moveEvent as TouchEvent).targetTouches[0] : (moveEvent as MouseEvent)
                const clipPath = (clipPathComponent.value!.$el as HTMLImageElement).getBoundingClientRect()

                // If event position is inside area run discover effect
                if (
                    position.clientX > clipPath.left - cursorSize.width / 2 &&
                    position.clientX < clipPath.left + clipPath.width + cursorSize.width / 2 &&
                    position.clientY > clipPath.top - cursorSize.height / 2 &&
                    position.clientY < clipPath.top + clipPath.height + cursorSize.height / 2
                ) {
                    // Update state references
                    if (!clipPathIsMoving.value) {
                        clipPathIsMoving.value = true
                        clipPathStartMoving.value = true
                        setTimeout(() => {
                            clipPathStartMoving.value = false
                        }, 100)
                    }

                    // Update cursor and clip path position
                    const x = position.clientX - clipPath.left
                    const y = position.clientY - clipPath.top
                    ;(clipPathComponent.value!.$el as HTMLImageElement).style.clipPath =
                        `circle(41.666% at ${x}px ${y}px)`
                    cursorElements.value?.forEach((element) => {
                        element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(2.5)`
                    })

                    // Otherwise clean up discover effect
                } else {
                    handleCleanUp()
                }
            }

            // Add move event listener to start event target
            startEvent.target!.addEventListener(moveEventType, handleMoveEvent)

            /**
             * It handles the clean up of the discover effect.
             */
            const handleCleanUp = () => {
                // Remove event listeners
                startEvent.target!.removeEventListener(moveEventType, handleMoveEvent)
                if (isTouch) {
                    startEvent.target!.removeEventListener('touchend', handleCleanUp)
                } else {
                    window.removeEventListener('scroll', handleCleanUp)
                }

                // Clean up state reference
                clipPathIsMoving.value = false

                // Clean up cursor and clip path position
                ;(clipPathComponent.value!.$el as HTMLImageElement).style.clipPath = initClipPath
                cursorElements.value?.forEach((element) => (element.style.transform = ''))
            }

            // Add clean up event listener
            if (isTouch) {
                startEvent.target!.addEventListener('touchend', handleCleanUp)
            } else {
                window.addEventListener('scroll', handleCleanUp)
            }
        }

        return {
            DIRECTUS_CMS_URL,
            fullName,
            platforms,
            cursorElements,
            initClipPath,
            clipPathComponent,
            clipPathIsMoving,
            clipPathStartMoving,
            handleDiscoverEffect,
        }
    },
  methods: { trackGoal },
})
</script>
