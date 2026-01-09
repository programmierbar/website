<template>
    <div class="flex h-20 items-center justify-center overflow-hidden bg-lime lg:h-36" data-cursor-black>
        <p
            class="news-ticker whitespace-nowrap text-xl italic selection:bg-black selection:text-white lg:text-4xl"
            :style="style"
        >
            <span v-for="occurrence in 4" :key="occurrence">
                <span v-for="(preparedNewsItem, index) in preparedNewsItems" :key="occurrence + preparedNewsItem + index" v-html="preparedNewsItem">
                </span>
            </span>
        </p>
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import DOMPurify from 'isomorphic-dompurify';

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
        const preparedNewsItems = computed(() => {
          return props.news.map(news => `${DOMPurify.sanitize(news, {FORBID_TAGS: ['p']})} +++ `)
        })

        return {
          style,
          preparedNewsItems
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
