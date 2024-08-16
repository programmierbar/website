<template>
  <div class='flex mb-6 items-center'>
    <div class='h-24 w-24 md:h-64 md:w-64'>
      <ProfilePicture :image='profile.profile_image' />
    </div>
    <div class='h-full flex flex-col pl-7'>
      <h1 class='font-bold text-4xl'>
        {{ profile.first_name }} {{ profile.last_name }}
      </h1>
      <p class='text-2xl font-light italic'>
        🎂 dabei seit
        <NuxtTime :datetime='profile.date_created_prepared' month='long' day='numeric' year='numeric' />
      </p>
    </div>
  </div>
</template>

<script setup lang='ts'>
import type { DirectusProfileItem } from '~/types';

const props = defineProps<{
  profile: DirectusProfileItem,
}>();
</script>
