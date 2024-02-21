<template>
  <nuxt-img
    :src="`${DIRECTUS_CMS_URL}/assets/${image.id}`"
    :alt="image.title || alt"
    :width="image.width ?? 0"
    :height="image.height ?? 0"
    :sizes="sizes"
    :loading="loading"
    :format="format"
    quality="80"
    fit="cover"
  />
</template>

<script lang="ts">
import type { PropType } from 'vue';
import { computed, defineComponent } from 'vue';
import type { FileItem } from '../types';
import { DIRECTUS_CMS_URL } from '../config';

export default defineComponent({
  props: {
    image: {
      type: Object as PropType<FileItem>,
      required: true,
    },
    sizes: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      default: '',
    },
    loading: {
      type: String as PropType<'lazy' | 'auto'>,
      default: undefined,
    },
  },
  setup(props) {
    // Create image format
    const format = computed(() => props.image.type.split('/')[1]);

    return {
      format,
      DIRECTUS_CMS_URL,
    };
  },
});
</script>
