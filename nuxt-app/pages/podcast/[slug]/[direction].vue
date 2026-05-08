<template>
    <PodcastEpisodePage :slug="(route.params.slug as string)" :initial-vote="direction" />
</template>

<script setup lang="ts">
const route = useRoute()

const direction = computed(() => {
    const d = route.params.direction
    if (d !== 'up' && d !== 'down') {
        throw createError({ statusCode: 404, message: 'Not found' })
    }
    return d as 'up' | 'down'
})
</script>
