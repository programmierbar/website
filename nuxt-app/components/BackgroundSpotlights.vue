<template>
  <!--<BackgroundSpotlight class="absolute z-20 h-192 w-auto" :class="position"/>-->
  <div class='h-192 w-160 bg-no-repeat bg-contain absolute'
       :class="position"
       :style="{
         backgroundImage: `url(${backgroundSpotlightImage})`,
         zIndex: index,
       }"
  ></div>
</template>

<script setup lang="ts">
import BackgroundSpotlight from '~/assets/images/spotlights.svg'
import backgroundSpotlightImage from '~/assets/images/spotlights.png';

import { defineProps } from 'vue'

const props = defineProps<{
  position: string
  index: string
}>();

</script>

<style scoped>
</style>
