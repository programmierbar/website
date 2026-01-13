<template>
  <div v-if="message" class='mt-8 space-y-8 text-base font-bold leading-normal text-lime md:mt-14 md:text-xl lg:text-2xl'>
    {{ message.text }}
  </div>
</template>

<script setup lang='ts'>
  const { message, clearMessage } = useFlashMessage();
</script>

<style scoped lang='postcss'>

</style>
