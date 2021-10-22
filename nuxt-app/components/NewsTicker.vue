<template>
  <div
    class="
      h-20
      lg:h-36
      flex
      items-center
      justify-center
      bg-lime
      overflow-hidden
    "
    data-cursor-black
  >
    <p
      class="news-ticker text-xl lg:text-4xl italic whitespace-nowrap"
      :style="style"
    >
      <span v-for="item in 4" :key="item">
        <span v-for="newsItem in news" :key="newsItem"
          >{{ newsItem }}<span class="font-black mx-5">+++</span></span
        >
      </span>
    </p>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    markdown: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    // Create news list
    const news = computed(() =>
      props.markdown
        ?.replace(/(^- |\n- )/g, '|')
        .split('|')
        .slice(1)
    );

    // Create style with animation duration
    const style = computed(
      () => `animation-duration: ${props.markdown.length * 0.2}s`
    );

    return {
      news,
      style,
    };
  },
});
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
