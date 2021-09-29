<template>
  <span ref="typedTextElement" class="text-transparent">
    <slot />
  </span>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from '@nuxtjs/composition-api';

export default defineComponent({
  setup() {
    // Create typed text element reference
    const typedTextElement = ref<HTMLSpanElement>();

    // Start typing animation when component has been mounted
    onMounted(() => {
      // Create necessary variables
      let addedText = '';
      let remainingText = typedTextElement.value!.innerText;
      let currentIndex = 0;
      const lastIndex = remainingText.length - 1;

      /**
       * It types the next letter of the typed text animation.
       */
      const typeNextLetter = () => {
        if (currentIndex <= lastIndex) {
          addedText +=
            '<span class="text-white">' + remainingText.charAt(0) + '</span>';
          remainingText = remainingText.substring(1);
          typedTextElement.value!.innerHTML = addedText + remainingText;

          // Increase current index by 1
          currentIndex += 1;

          // Repeat function with delay until last letter has been reached
          setTimeout(typeNextLetter, 50);
        }
      };

      // Start typing first letter
      typeNextLetter();
    });

    return { typedTextElement };
  },
});
</script>
