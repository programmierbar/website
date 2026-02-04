<template>
  <vue-json-pretty :data="content" :theme="theme" :show-line='showLine' :show-line-number='showLineNumber'/>
</template>

<script setup lang='ts'>
import VueJsonPretty from 'vue-json-pretty';

const props = withDefaults(defineProps<{
  data: object | string;
  theme?: "dark" | "light"
  showLine?: boolean
  showLineNumber?: boolean
}>(), {
  theme: "dark",
  showLine: false,
  showLineNumber: true,
});

const content = computed(() => {
  if (typeof props.data === 'string') {
    return JSON.parse(props.data);
  } else {
    return props.data;
  }
})
</script>

<style>
.vjs-tree {
  padding: 0 !important;
  color: white;
}

@media (min-width: 768px) {
  .vjs-tree-node {
    font-size: 1.5rem;
    line-height: 1.5;
  }
}

.vjs-key {
  color: white;
}

.vjs-tree-brackets {
  color: white;
}
</style>
