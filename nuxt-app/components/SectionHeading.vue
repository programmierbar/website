<template>
    <div class="md:pointer-events-none md:absolute md:left-0 md:top-0 md:z-10 md:h-full">
        <component
            :is="element"
            class="md:vertical-rl text-2xl font-black text-white md:sticky md:left-6 md:top-32 md:ml-6 md:whitespace-nowrap md:text-5xl lg:left-8 lg:top-48 lg:text-6xl"
        >
            <slot />
        </component>
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        element: {
            type: String as PropType<'h1' | 'h2'>,
            required: true,
        },
    },
})
</script>
