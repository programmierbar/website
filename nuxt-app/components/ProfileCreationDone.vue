<script setup lang="ts">
defineProps<{
    mainText: string
}>()
</script>

<template>
    <div class="profile-creation-done mt-20 flex flex-col items-center justify-center">
        <div class="flex-col items-center justify-center md:flex">
            <div
                class="mb-2 mt-5 text-3xl font-semibold italic leading-[3rem] text-white md:text-4xl"
                v-html="mainText"
            />
        </div>

        <div class="mt-20 flex flex-col items-center justify-center gap-y-4">
            <PrimaryPbButton class="w-60 py-2 uppercase">Let's Go!</PrimaryPbButton>
            <span class="text-sm font-light italic text-white">Profil bearbeiten</span>
        </div>
    </div>
</template>
