<template>
    <div
        ref="tagFilterElement"
        class="3xl:top-9 sticky top-24 z-20 lg:top-32"
        :class="!filterIsOpen && 'pointer-events-none'"
    >
        <div class="relative h-8 md:h-9 lg:h-11">
            <div class="absolute left-0 top-0 w-full">
                <div class="relative min-h-8 w-full overflow-hidden md:min-h-9 lg:min-h-11">
                    <!-- Background box -->
                    <div
                        class="md:border-3 border-lime absolute right-0 top-0 rounded-2xl border-2 bg-black transition-all duration-200 md:rounded-3xl lg:border-4 xl:duration-300"
                        :class="filterIsOpen ? 'h-full w-full' : 'h-8 w-20 md:h-9 md:w-24 lg:h-11 lg:w-28'"
                    >
                        <!-- Open or close button -->
                        <button
                            class="text-lime pointer-events-auto absolute bottom-0 left-0 z-20 flex h-full max-h-8 items-center rounded-full bg-black bg-opacity-40 px-2.5 transition-all duration-200 md:max-h-9 md:px-3 lg:max-h-11 lg:px-3.5 xl:duration-300"
                            :class="filterIsOpen ? '-translate-y-2 translate-x-2' : 'w-full'"
                            type="button"
                            data-cursor-hover
                            @click="toggleFilter"
                        >
                            <div
                                class="h-4 transition-transform duration-200 md:h-5 lg:h-6 xl:duration-300"
                                :class="filterIsOpen && 'rotate-90'"
                                v-html="angleLeftIcon"
                            />
                            <div
                                class="translate-x-2 pt-px text-sm font-bold transition-opacity duration-200 md:pt-0.5 md:text-base lg:pt-1 lg:text-xl xl:duration-300"
                                :class="filterIsOpen && 'w-0 opacity-0'"
                            >
                                Filter
                            </div>
                        </button>
                    </div>

                    <!-- Tag list -->
                    <TagList
                        class="max-h-1/2-screen md:my-0.75 relative z-10 my-0.5 origin-top-right overflow-y-auto p-5 pb-12 transition duration-200 md:p-6 md:pb-14 lg:my-1 lg:p-7 lg:pb-16 xl:duration-300"
                        :class="!filterIsOpen && 'invisible scale-0 opacity-0'"
                        :style="!filterIsOpen ? 'transition: visibility 0s .2s, opacity .2s, transform .2s' : undefined"
                        :tags="tags"
                        :on-click="toggleTag"
                        variant="tag_filter"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import angleLeftIcon from '~/assets/icons/angle-left.svg?raw'
import { useDocument, useEventListener } from '~/composables'
import { CLOSE_TAG_FILTER_EVENT_ID, OPEN_TAG_FILTER_EVENT_ID } from '~/config'
import { trackGoal } from '~/helpers'
import type { TagItem } from '~/types'
import { ref, watch } from 'vue'
import TagList from './TagList.vue'

const props = defineProps<{
    tags: Tag[]
    toggleTag: (tag: Tag, index: number) => void
}>()
const { tags, toggleTag } = toRefs(props)

interface Tag extends Pick<TagItem, 'id' | 'name'> {
    is_active?: boolean
}

// Create tag filter element reference
const tagFilterElement = ref<HTMLDivElement>()

// Create filter is open reference
const filterIsOpen = ref(false)

// Track analytic events
watch(filterIsOpen, () => {
    if (filterIsOpen.value) {
        trackGoal(OPEN_TAG_FILTER_EVENT_ID)
    } else {
        trackGoal(CLOSE_TAG_FILTER_EVENT_ID)
    }
})

/**
 * It closes the tag filter when clicked outside.
 */
const handleClick = (event: Event) => {
    if (filterIsOpen.value && !tagFilterElement.value!.contains(event.target as Node)) {
        filterIsOpen.value = false
    }
}

// Add click event listener
useEventListener(useDocument(), 'click', handleClick)

/**
 * It opens or closes the filter.
 */
const toggleFilter = () => {
    filterIsOpen.value = !filterIsOpen.value
}
</script>
