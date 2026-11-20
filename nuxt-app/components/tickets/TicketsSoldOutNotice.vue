<template>
    <div
        class="relative overflow-hidden rounded-2xl border-2 border-lime bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.4),_rgba(168,85,247,0.3)_35%,_rgba(207,255,0,0.12)_70%,_transparent)] p-6 md:p-8"
        role="status"
    >
        <div
            class="inline-block rounded-full bg-lime/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-lime"
        >
            Ausverkauft
        </div>
        <p class="mt-4 text-3xl font-black leading-tight text-white md:text-4xl">Alle Tickets sind vergeben</p>
        <p class="mt-3 text-lg font-light leading-normal text-white/80">
            Die {{ conferenceTitle }} ist ausverkauft. Vielen Dank für euer großes Interesse – wir freuen uns auf alle,
            die dabei sind!
        </p>
        <slot />
    </div>
</template>

<script setup lang="ts">
defineProps<{
    conferenceTitle: string
}>()
</script>
