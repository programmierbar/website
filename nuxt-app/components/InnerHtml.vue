<template>
    <div class="inner-html" :class="variantClass" v-html="html" />
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'

export default defineComponent({
    props: {
        html: {
            type: String,
            required: true,
        },
        variant: {
            type: String as PropType<'default' | 'pick_of_the_day_card'>,
            default: 'default',
        },
    },
    setup(props) {
        // Convert variant to class string
        const variantClass = computed(() => props.variant.replace(/_/g, '-'))

        return {
            variantClass,
        }
    },
})
</script>

<style lang="postcss">
.inner-html p {
    @apply whitespace-pre-line;
}
.inner-html strong {
    @apply font-black;
}
.inner-html a {
    @apply font-bold text-lime transition-colors hover:text-blue;
}
.inner-html.pick-of-the-day-card *::selection {
    @apply bg-black text-white;
}
.inner-html.pick-of-the-day-card a {
    @apply text-pink hover:text-blue;
}
.inner-html ul {
    @apply list-disc;
}
.inner-html ol {
    @apply list-decimal;
}
.inner-html ul,
.inner-html ol {
    @apply ml-4 md:ml-6 lg:ml-8;
}
.inner-html li {
    @apply pl-1 md:pl-3 lg:pl-4;
}
.inner-html ul > * + *,
.inner-html ol > * + * {
    @apply mt-4;
}
</style>
