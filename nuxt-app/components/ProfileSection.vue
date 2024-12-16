<script setup lang="ts">
defineProps<{
    title: string
    html?: string
    content?: string
}>()
</script>

<template>
    <div class="profile-section">
        <h2 class="mb-6 mt-16 text-xl font-bold md:text-4xl">{{ title }}</h2>
        <p v-if="content" class="text-base font-light md:text-3xl">{{ content }}</p>
        <InnerHtml v-else-if="html" :html="html" class="text-base font-light md:text-3xl" />
        <slot></slot>
    </div>
</template>
