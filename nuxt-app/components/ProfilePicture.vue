<script setup lang="ts">
import EmptyProfilePicture from '~/assets/images/profile-picture-empty.svg'
import { useProfileCreationStore } from '~/composables/useProfileCreationStore'
import { ref } from 'vue'

const store = useProfileCreationStore()
const fileInput = ref<HTMLInputElement | null>(null)

const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
        const file = target.files[0]
        const previewUrl = URL.createObjectURL(file)
        store.updateProfilePicture(file, previewUrl)
    }
}

const triggerFileInput = () => {
    fileInput.value?.click()
}
</script>

<template>
    <div class="mt-10 flex flex-col items-center justify-center">
        <div
            class="profile-picture flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-t from-white/20 to-white/80 md:h-64 md:w-64"
        >
            <img
                v-if="store.profilePicture.previewUrl"
                :src="store.profilePicture.previewUrl"
                alt="Profile Picture"
                class="h-full w-full rounded-full object-cover"
            />
            <EmptyProfilePicture v-else />
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
        <PrimaryPbButton
            class="mt-5 w-44 border-[1.4px] text-base font-light italic tracking-normal md:w-72 md:py-2 md:text-2xl md:tracking-wide"
            @click="triggerFileInput"
        >
            Profilbild hochladen
        </PrimaryPbButton>
    </div>
</template>
