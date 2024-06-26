<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk';
import { isPublishable } from './../shared/isPublishable.js';
import { onMounted, ref } from 'vue';

const props = defineProps<{ collection: string; primaryKey: string }>();

const publishable = ref(false);

function loadItem(collection: string, primaryKey: string) {
  const api = useApi();
  const response = api.get(`/items/${collection}/${primaryKey}`);

  return response;
}
function loadFields(collection: string) {
  const api = useApi();
  const response = api.get(`/fields/${collection}`);

  return response;
}

onMounted(async () => {
  if (props.primaryKey !== '+') {
    const [itemResponse, fieldResponse] = await Promise.all([
      loadItem(props.collection, props.primaryKey),
      loadFields(props.collection),
    ]);
    const itemData = itemResponse.data.data;
    const fieldData = fieldResponse.data.data;

    publishable.value = isPublishable(itemData, fieldData);
  }
});
</script>

<template>
  <div v-if="publishable === true">
    <v-icon name="check_circle" left />
    Can be published.
  </div>
  <div v-else-if="publishable === false">
    <v-icon name="unpublished" left />
    Can not be published.
  </div>
  <div v-else-if="publishable === null">
    <v-progress-circular indeterminate />
    Publishable state not yet determined...
  </div>
  <div v-else>
    <v-icon name="warning" left />
    Unknown publishable state. This should not happen and indicates an error.
  </div>
</template>
