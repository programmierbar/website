<script setup lang="ts">
import EmptyProfilePicture from '~/assets/images/profile-picture-empty.svg'
import type { DirectusFileItem } from '~/types'
import type { ComputedRef } from 'vue'

const props = defineProps<{
    image: DirectusFileItem | string | null
}>()

const directusImage: ComputedRef<DirectusFileItem | null> = computed(() => {
    return typeof props.image !== 'undefined' && typeof props.image !== 'string' ? props.image : null
})

const urlImage: ComputedRef<string | null> = computed(() => {
    return typeof props.image === 'string' ? props.image : null
})
</script>

<template>
    <div class="flex flex-col items-center justify-center">
        <div
            class="profile-picture flex flex-col items-center justify-center overflow-clip rounded-full border-4 border-white bg-gradient-to-t from-white/20 to-white/80"
        >
            <DirectusImage v-if="directusImage" :image="directusImage" :sizes="''" class="h-full w-full object-cover" />
            <img v-else-if="urlImage" :src="urlImage" alt="Profile Picture" class="h-full w-full object-cover" />
            <EmptyProfilePicture v-else class="h-full w-full" />
        </div>
    </div>
</template>
