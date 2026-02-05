<template>
    <div class="flex justify-between py-3 text-2xl" data-cursor-hover @click="toggle">
        <p class="font-bold text-white">
            {{ faq.question }}
        </p>
        <div class="min-w-6 max-w-6 text-white">
            <AngleDownIcon
                class="max-w-full fill-white stroke-white transition-all duration-500"
                :class="{ 'rotate-180': isOpened }"
            />
        </div>
    </div>
    <InnerHtml
        class="mb-3 h-0 overflow-hidden text-xl font-light text-white opacity-0 transition-all duration-500 ease-in-out"
        :class="{ 'h-auto opacity-100': isOpened }"
        :html="faq.answer"
    />
</template>

<script setup lang="ts">
import AngleDownIcon from 'assets/icons/angle-down.svg'

defineProps<{
    faq: {
        question: string
        answer: string
    }
}>()

const isOpened = ref(false)

function toggle() {
    isOpened.value = !isOpened.value
}
</script>
