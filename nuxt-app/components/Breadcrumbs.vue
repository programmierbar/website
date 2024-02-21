<template>
  <div>
    <ul
      class="flex flex-wrap text-sm lg:text-lg text-pink font-black uppercase -m-0.5"
    >
      <li
        v-for="breadcrumb of breadcrumbs"
        :key="breadcrumb.label"
        class="max-w-1/2-screen truncate m-0.5"
      >
        //
        <NuxtLink
          v-if="breadcrumb.href"
          :to="breadcrumb.href"
          class="hover:border-b-3 border-pink"
          data-cursor-hover
        >
          {{ breadcrumb.label }}
        </NuxtLink>
        <span v-else>{{ breadcrumb.label }} </span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { PropType } from 'vue';

export default defineComponent({
  props: {
    breadcrumbs: {
      type: Array as PropType<
        {
          label: string;
          href?: string;
        }[]
      >,
      required: true,
    },
  },
});
</script>
