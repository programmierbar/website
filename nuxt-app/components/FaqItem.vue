<template>
  <div class='flex justify-between py-3' v-on:click='toggle' data-cursor-hover>
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
  <div
    class="text-white transition-all duration-500 ease-in-out opacity-0 max-h-0 overflow-hidden"
    :class="{ 'opacity-100 max-h-full mb-3': isOpened }"
  >
    <InnerHtml
      class=' text-white mb-3'
      :html='faq.answer'
    />
  </div>
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
