<template>
  <div class='flex justify-between py-3 text-2xl' v-on:click='toggle' data-cursor-hover>
    <p class='text-white font-bold'>
      {{ faq.question }}
    </p>
    <div class='text-white max-w-6 min-w-6'>
      <AngleDownIcon
        class='stroke-white fill-white transition-all duration-500 max-w-full'
        :class="{ 'rotate-180': isOpened }"
      />
    </div>
  </div>
  <InnerHtml
    class=' text-white text-xl font-light opacity-0 transition-all duration-500 ease-in-out h-0 overflow-hidden mb-3'
    :class="{ 'opacity-100 h-auto': isOpened }"
    :html='faq.answer'
  />
</template>

<script setup lang='ts'>
import AngleDownIcon from 'assets/icons/angle-down.svg';

defineProps<{
  faq: {
    question: string;
    answer: string;
  };
}>();

const isOpened = ref( false);

function toggle() {
  isOpened.value = !isOpened.value;
}
</script>
