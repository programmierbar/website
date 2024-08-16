<template>
  <h2 class='mb-8 mt-16 font-bold text-4xl'>{{ title }}</h2>
  <p v-if='content' class='text-3xl font-light'>{{ content }}</p>
  <InnerHtml v-else-if='html' :html='html' class='text-3xl font-light'/>
  <slot></slot>
</template>

<script setup lang='ts'>
const props = defineProps<{
  title: string,
  html?: string,
  content?: string,
}>();
</script>
