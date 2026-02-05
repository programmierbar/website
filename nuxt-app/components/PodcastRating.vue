<template>
    <div class="mt-8 flex w-full flex-col items-end space-y-8">
        <div v-if="!message" class="box-border w-fit rounded-full bg-gray-500 p-2">
            <button
                type="button"
                class="inline-block border-r-1 border-white p-1 md:p-3"
                data-cursor-hover
                @click="rate('up')"
            >
                <thumbs_up class="-mt-1 inline h-4 pr-1 md:-mt-2 md:h-6" />
            </button>
            <button type="button" class="inline-block p-1 md:p-3" data-cursor-hover @click="rate('down')">
                <thumbs_down class="inline h-4 pl-2 md:h-6" />
            </button>
        </div>
        <div v-if="message" class="p-4 text-base font-bold leading-normal text-lime md:text-xl lg:text-2xl">
            <p>{{ message.text }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import thumbs_down from '~/assets/icons/thumb-down.svg'
import thumbs_up from '~/assets/icons/thumb-up.svg'
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusPodcastItem } from '~/types'

const { message, setMessage, clearMessage } = useFlashMessage()
const directus = useDirectus()

const props = defineProps<{ podcast: DirectusPodcastItem }>()

const rate = async function (upOrDown: 'up' | 'down') {
    await directus.createRating(upOrDown, props.podcast)
    setMessage('Vielen Dank für dein Feedback!', 'rating', {})
}

onUnmounted(() => {
    clearMessage()
})
</script>

<style scoped lang="postcss"></style>
