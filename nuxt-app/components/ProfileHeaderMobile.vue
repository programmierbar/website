<script setup lang="ts">
import LocationIcon from '~/assets/icons/location.svg'
import StarIcon from '~/assets/icons/star.svg'
import SuitcaseIcon from '~/assets/icons/suitcase.svg'
import type { DirectusProfileItem } from '~/types'

defineProps<{
    profile: DirectusProfileItem
}>()
</script>

<template>
    <div class="mb-6 flex flex-col items-start gap-y-6 text-sm font-light">
        <ProfilePicture class="h-24 w-32 md:h-64 md:w-64" :image="profile.profile_image" />

        <div class="flex h-full flex-col">
            <h1 class="text-3xl font-bold">{{ profile.first_name }} {{ profile.last_name }}</h1>
        </div>
        <div class="flex flex-col gap-y-4">
            <div class="flex flex-row items-center gap-x-2">
                <SuitcaseIcon class="w-6" />
                <div>
                    <span v-if="profile.job_role"> {{ profile.job_role }}</span>
                    <span v-if="profile.job_employer"> bei {{ profile.job_employer }}</span>
                </div>
            </div>
            <div class="flex flex-row items-center gap-x-2">
                <LocationIcon class="w-5" />
                <span>Frankfurt am Main</span>
            </div>
            <div v-if="profile.emojis_prepared" class="flex flex-row gap-x-2">
                <StarIcon class="w-6" />
                <span v-for="emoji of profile.emojis_prepared" :key="emoji.id" class="ml-1 text-2xl">{{
                    emoji.display_emoji
                }}</span>
            </div>
        </div>
    </div>
</template>
