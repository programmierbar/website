<script setup lang="ts">
import { useProfileCreationStore } from '~/composables/useProfileCreationStore'
import { storeToRefs } from 'pinia'

defineProps<{
    heading: string
    mainText: string
}>()

const emit = defineEmits(['validityChange'])

const store = useProfileCreationStore()
const { selectedEmojis } = storeToRefs(store)

function onEmojiSelectionChange(emojis: string[]) {
    store.updateSelectedEmojis(emojis)
    emit('validityChange', emojis.length === 3)
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
        <EmojiPicker class="mt-8" :selected-emojis="selectedEmojis" @selection-change="onEmojiSelectionChange" />
    </div>
</template>
