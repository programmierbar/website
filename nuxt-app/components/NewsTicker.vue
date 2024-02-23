<template>
    <div class="flex h-20 items-center justify-center overflow-hidden bg-lime lg:h-36" data-cursor-black>
        <p
            class="news-ticker whitespace-nowrap text-xl italic selection:bg-black selection:text-white lg:text-4xl"
            :style="style"
        >
            <span v-for="occurrence in 4" :key="occurrence">
                <span v-for="(newsItem, index) in news" :key="occurrence + newsItem + index"
                    >{{ newsItem }}<span class="mx-5 font-black">+++</span></span
                >
            </span>
        </p>
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'

export default defineComponent({
    props: {
        news: {
            type: Array as PropType<string[]>,
            required: true,
        },
    },
    setup(props) {
        // Create style with animation duration
        const style = computed(() => `animation-duration: ${props.news.join().length * 0.2}s`)

        return {
            style,
        }
    },
})
</script>

<style scoped>
@keyframes news-ticker {
    from {
        transform: translateX(12.5%);
    }
    to {
        transform: translateX(-12.5%);
    }
}
.news-ticker {
    animation: news-ticker linear infinite;
}
</style>
