<template>
    <article
        class="agenda-card flex flex-col gap-1 rounded-s px-4 py-3"
        :class="isService ? 'agenda-card--service' : 'agenda-card--talk'"
        :title="`${start}–${end}`"
        :data-cursor-hover="clickable ? true : null"
        @click="$emit('select')"
    >
        <div v-if="duration || track" class="flex flex-wrap items-center gap-2 text-xs text-shade-300">
            <span v-if="duration">{{ duration }}</span>
            <span v-if="track" class="rounded-full border-1 border-shade-600 px-2 text-white">{{ track }}</span>
        </div>
        <header class="text-sm md:text-lg" :class="isService ? 'text-shade-200' : 'font-bold text-white'">
            {{ title }}
        </header>
        <div v-if="subtitle" class="text-sm text-shade-300">{{ subtitle }}</div>
    </article>
</template>

<script setup lang="ts">
defineProps<{
    title: string
    subtitle?: string
    /** Formatted start and end time, only used for the hover title */
    start: string
    end: string
    /** Human readable duration, e.g. "45 Min" */
    duration?: string
    /** Track label shown as a chip (mobile list only) */
    track?: string
    /** Catering, registration and other organisational slots without a talk */
    isService: boolean
    clickable: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<style scoped>
.agenda-card--talk {
    background: #1e1f23;
    border: 1px solid rgb(255 255 255 / 0.11);
}

.agenda-card--service {
    border: 1px dashed rgb(255 255 255 / 0.22);
}
</style>
