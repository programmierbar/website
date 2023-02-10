<template>
  <div
    class="rounded-xl relative w-full max-h-96 flex flex-col overflow-hidden"
  >
    <div
      class="
        relative
        top-0
        left-0
        bg-gray-800
        w-full
        py-2
        flex
        items-center
        justify-center
      "
    >
      <div class="absolute left-3 flex flex-row gap-1.5">
        <div
          v-for="index in 3"
          :key="index"
          class="rounded-full bg-gray-700 h-2.5 w-2.5"
        ></div>
      </div>
      <div
        class="
          truncate
          text-center text-white text-opacity-60 text-sm
          md:text-base
          text-ellipsis
          font-extralight
          whitespace-pre-line
          w-1/2
          md:w-3/4
        "
      >
        {{ `/transkript/programmierbar/${name}`.trim() }}
      </div>
    </div>
    <div class="relative bg-gray-900 w-full overflow-auto scrollbar:!w-1.5">
      <div
        class="
          font-mono
          whitespace-pre-line
          text-white text-sm
          md:text-base
          lg:text-lg
          px-8
          md:px-16
          pb-32
          pt-8
        "
      >
        {{ body.trim() }}
      </div>
    </div>
    <div
      class="absolute bottom-0 bg-gradient-to-t from-black h-24 w-full"
    ></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    name: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
  },
  setup() {
    return {};
  },
});
</script>
