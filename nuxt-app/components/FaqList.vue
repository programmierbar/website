<template>
  <div class='mt-16 mb-16'>
    <div v-for="faq of faqs" :key="faq.question">
      <hr class='border-white' />
      <FaqItem :faq='faq' />
    </div>
  </div>
</template>

<script setup lang='ts'>
import FaqItem from '~/components/FaqItem.vue';

defineProps<{
  faqs: {
    question: string;
    answer: string;
  }[];
}>();
</script>
