<template>
    <div class="relative flex max-h-96 w-full flex-col overflow-hidden rounded-xl">
        <div class="relative left-0 top-0 flex w-full items-center justify-center bg-gray-800 py-2">
            <div class="absolute left-3 flex flex-row gap-1.5">
                <div v-for="index in 3" :key="index" class="h-2.5 w-2.5 rounded-full bg-gray-600"></div>
            </div>
            <div
                class="w-1/2 truncate text-ellipsis whitespace-nowrap text-center text-sm font-extralight text-white text-opacity-60 md:w-3/4 md:text-base"
            >
                {{ `/transkript/programmierbar/${name}`.trim() }}
            </div>
        </div>
        <div class="scrollbar:!w-1.5 relative w-full overflow-auto bg-gray-900">
            <div
                class="whitespace-pre-line px-8 pb-32 pt-8 font-mono text-sm text-white md:px-16 md:text-base lg:text-lg"
            >
                {{ body.trim() }}
            </div>
        </div>
        <div class="absolute bottom-0 h-24 w-full bg-gradient-to-t from-black"></div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        name: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
    },
    setup() {
        return {}
    },
})
</script>
