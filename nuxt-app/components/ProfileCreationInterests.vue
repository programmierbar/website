<script setup lang="ts">
import SearchSVG from '~/assets/icons/search.svg'
import type { Tag } from '~/composables/useDirectus'
import { useProfileCreationStore } from '~/composables/useProfileCreationStore'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
    heading: string
    mainText: string
    tags: Tag[]
}>()

const emit = defineEmits(['validityChange'])

const store = useProfileCreationStore()
const { selectedInterests } = storeToRefs(store)

const searchQuery = ref('#')

const filteredTags = computed(() => {
    const query = searchQuery.value.slice(1).toLowerCase() // Remove '#' for filtering
    let filtered: Tag[]

    if (query) {
        filtered = props.tags.filter((tag) => tag.name.toLowerCase().includes(query))
    } else {
        filtered = [...props.tags].sort((a, b) => b.count - a.count)
    }

    // Prioritize selected interests
    const prioritizedTags = filtered.sort((a, b) => {
        const aSelected = selectedInterests.value.includes(a)
        const bSelected = selectedInterests.value.includes(b)
        if (aSelected && !bSelected) return -1
        if (!aSelected && bSelected) return 1
        return 0
    })

    return prioritizedTags.slice(0, 5)
})

function toggleTag(tag: Tag) {
    if (selectedInterests.value.includes(tag)) {
        selectedInterests.value = selectedInterests.value.filter((t) => t !== tag)
    } else {
        selectedInterests.value = [...selectedInterests.value, tag]
    }

    emit('validityChange', selectedInterests.value.length >= 5)
    store.updateSelectedInterests(selectedInterests.value)
}

function isSelected(tag: Tag) {
    return selectedInterests.value.includes(tag)
}

watch(searchQuery, (newValue) => {
    if (!newValue.startsWith('#')) {
        searchQuery.value = '#' + newValue.replace('#', '')
    }
})

const handleInput = (event: Event) => {
    const inputEvent = event as InputEvent
    if (inputEvent.inputType === 'deleteContentBackward' && searchQuery.value === '#') {
        event.preventDefault()
    }
}
</script>

<template>
    <div class="profile-creation-intro flex flex-col items-center justify-center">
        <div class="flex-col items-center justify-center md:flex">
            <div class="mb-2 mt-5 text-3xl font-semibold italic leading-[3rem] text-white md:text-4xl">
                {{ heading }}
            </div>
        </div>

        <div class="intro-text mb-2 mt-5 text-base font-light text-white md:text-4xl">{{ mainText }}</div>

        <div class="relative mb-10 mt-4 w-full max-w-120">
            <input
                v-model="searchQuery"
                type="text"
                class="w-full rounded-lg border-1 border-white bg-black p-2 pr-10 text-center italic text-white"
                @input="handleInput"
            />
            <SearchSVG class="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white" />
        </div>

        <div class="flex w-full max-w-120 flex-wrap justify-start">
            <SelectionBox
                v-for="tag in filteredTags"
                :key="tag.name"
                disable-random-animations
                selection-animation="grow"
                class="mb-2 mr-2 px-4 py-2 text-base text-white md:hover:scale-110"
                :content="'#' + tag.name"
                :is-selected="isSelected(tag)"
                @click="toggleTag(tag)"
            />
        </div>
    </div>
</template>

<style scoped lang="postcss"></style>
