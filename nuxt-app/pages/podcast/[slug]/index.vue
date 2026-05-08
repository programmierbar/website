<template>
    <PodcastEpisodePage :slug="(route.params.slug as string)" />
</template>

<script setup lang="ts">
const route = useRoute()
</script>
