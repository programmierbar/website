<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
    selectedEmojis: string[]
}>()

const emit = defineEmits(['selectionChange'])

const emojis = ['🔥', '😊', '🎉', '🚀', '💡', '🌈', '🍕', '🎸', '🌺', '🐱', '🦄', '🍦']
const localSelectedEmojis = ref(props.selectedEmojis)

function toggleEmoji(emoji: string) {
    if (localSelectedEmojis.value.includes(emoji)) {
        localSelectedEmojis.value = localSelectedEmojis.value.filter((e) => e !== emoji)
    } else {
        if (localSelectedEmojis.value.length >= 3) {
            localSelectedEmojis.value = localSelectedEmojis.value.slice(1)
        }

        localSelectedEmojis.value = [...localSelectedEmojis.value, emoji]
    }
}

function isSelected(emoji: string) {
    return localSelectedEmojis.value.includes(emoji)
}
function isDisabled() {
    return localSelectedEmojis.value.length >= 3
}

watch(localSelectedEmojis, (newValue) => {
    emit('selectionChange', newValue)
})
</script>

<template>
    <div class="emoji-picker grid grid-cols-4 gap-4">
        <div
            v-for="emoji in emojis"
            :key="emoji"
            :class="[
                'emoji-wrapper cursor-pointer transition-all duration-200 ease-in-out',
                isDisabled() && !isSelected(emoji) ? 'opacity-50' : '',
            ]"
            @click="toggleEmoji(emoji)"
        >
            <SelectionBox
                :content="emoji"
                :is-selected="isSelected(emoji)"
                selection-animation="wiggle-grow"
                class="h-14 w-18 text-2xl transition-transform duration-200 md:h-24 md:w-32 md:hover:scale-110"
            />
        </div>
    </div>
</template>
