<template>
    <section>
        <h2 class="text-sm font-black uppercase tracking-widest text-lime md:text-base">Mitwirkende</h2>
        <dl v-if="groups.length" class="mt-4 space-y-4 md:mt-6">
            <div v-for="group of groups" :key="group.label">
                <dt class="text-sm font-light uppercase tracking-widest text-white/70">{{ group.label }}</dt>
                <dd class="mt-1 text-base font-light text-white md:text-xl lg:text-2xl">
                    {{ group.names.join(', ') }}
                </dd>
            </div>
        </dl>
        <HeiseMissingValue v-else class="mt-4 md:mt-6">Noch keine Mitwirkenden hinterlegt.</HeiseMissingValue>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    guests: string[]
    hosts: string[]
}>()

// Many episodes have no guests, so an empty group is left out rather than flagged
const groups = computed(() =>
    [
        { label: 'Gäste', names: props.guests },
        { label: 'Hosts', names: props.hosts },
    ].filter((group) => group.names.length)
)
</script>
