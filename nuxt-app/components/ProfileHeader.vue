<script setup lang="ts">
import BirthdayCakeIcon from '~/assets/icons/birthday-cake.svg'
import type { DirectusProfileItem } from '~/types'

defineProps<{
    profile: DirectusProfileItem
}>()
</script>

<template>
    <div class="mb-6 flex flex-row items-center">
        <div class="h-24 w-24 md:h-64 md:w-64">
            <ProfilePicture :image="profile.profile_image" />
        </div>
        <div class="flex h-full flex-col gap-6 pl-7">
            <h1 class="text-4xl font-bold">{{ profile.first_name }} {{ profile.last_name }}</h1>
            <p v-if="profile.display_name" class="text-3xl font-light italic">@{{ profile.display_name }}</p>
            <div class="flex flex-row items-end gap-x-4 text-2xl font-light italic">
                <BirthdayCakeIcon class="h-10 w-6 align-middle" />
                <p>
                    Dabei seit dem
                    <NuxtTime :datetime="profile.date_created_prepared" month="long" day="numeric" year="numeric" />
                </p>
            </div>
        </div>
    </div>
</template>
