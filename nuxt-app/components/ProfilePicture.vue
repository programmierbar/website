<script setup lang="ts">
import EmptyProfilePicture from '~/assets/images/profile-picture-empty.svg'

// TODO - Implement the upload functionality
</script>

<template>
    <div class="mt-10 flex flex-col items-center justify-center">
        <div
            class="profile-picture flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-t from-white/20 to-white/80 md:h-64 md:w-64"
        >
            <EmptyProfilePicture />
        </div>
        <PrimaryPbButton
            class="mt-5 w-44 border-[1.4px] text-base font-light italic tracking-normal md:w-72 md:py-2 md:text-2xl md:tracking-wide"
        >
            Profilbild hochladen
        </PrimaryPbButton>
    </div>
</template>
