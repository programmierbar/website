<template>
  <span
    ><span
      v-for="(char, index) of charList"
      :key="char + index"
      class="typed-char"
      :style="{ animationDelay: `${index * 0.06}s` }"
      >{{ char }}</span
    ></span
  >
</template>

<script lang="ts">
import { computed, defineComponent } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    text: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    // Create char list of text
    const charList = computed(() => [...props.text]);

    return {
      charList,
    };
  },
});
</script>

<style scoped>
@keyframes type-char {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.typed-char {
  animation: type-char both;
}
</style>
