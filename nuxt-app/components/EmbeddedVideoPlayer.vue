<template>
  <iframe type="text/html"
          :src="videoUrl"
          frameborder="0">
  </iframe>
</template>

<script setup lang="ts">
import { computed } from 'vue'

function getEmbedUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    switch (url.hostname) {
      case "youtube.com":
      case "www.youtube.com":
        const videoId = url.searchParams.get('v');
        return `https://www.youtube.com/embed/${videoId}`;
      default:
        throw new Error('Invalid YouTube URL');
    }
  } catch (e: any) {
    console.error('Could not parse video URL: ' + urlString);
    console.log(e.message);
    return '';
  }
}

const props = defineProps<{
  url: string; // Example: https://www.youtube.com/watch?v=VNpzpu5dzso
}>();

const videoUrl = computed(() => getEmbedUrl(props.url));
</script>

<style scoped>
iframe {
  width: 100%;
  aspect-ratio: 16/9;
}
</style>
