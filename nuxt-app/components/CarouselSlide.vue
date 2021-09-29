<template>
  <li
    ref="slideElement"
    class="flex-shrink-0 transition-transform duration-300"
    :class="index !== activeIndex && 'scale-90 md:scale-75'"
    :data-cursor-arrow-left="index < activeIndex"
    :data-cursor-arrow-right="index > activeIndex"
    @click="makeActive"
  >
    <div :class="!isClickable && 'pointer-events-none'">
      <slot />
    </div>
  </li>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';

export default defineComponent({
  props: {
    index: {
      type: Number,
      required: true,
    },
    activeIndex: {
      type: Number,
      required: true,
    },
    isClickable: {
      type: Boolean,
      required: true,
    },
    isCenterable: {
      type: Boolean,
      required: true,
    },
  },
  setup(props, { emit }) {
    /**
     * Triggers a custom event that makes the current slide active.
     */
    const makeActive = () => {
      if (props.isCenterable) {
        emit('active-index-change', props.index);
      }
    };

    return { makeActive };
  },
});
</script>
