<template>
    <div class="mt-6 rounded-xl border-2 p-4" :class="tshirt.status === 'eligible' ? 'border-lime' : 'border-pink'">
        <template v-if="tshirt.status === 'eligible'">
            <div class="text-sm uppercase tracking-wide text-white/60">T-Shirt</div>
            <div class="text-6xl font-bold text-lime">{{ tshirt.size }}</div>
        </template>
        <template v-else-if="tshirt.status === 'too_late'">
            <div class="text-xl font-bold text-pink">Nach der Deadline registriert – kein T-Shirt</div>
            <div v-if="tshirt.size" class="mt-1 text-sm text-white/60">Angegebene Größe: {{ tshirt.size }}</div>
        </template>
        <div v-else class="text-xl font-bold text-pink">Keine T-Shirt-Größe angegeben</div>
    </div>
</template>

<script setup lang="ts">
import type { CheckinTshirtInfo } from '~/types/directus'

defineProps<{ tshirt: CheckinTshirtInfo }>()
</script>
