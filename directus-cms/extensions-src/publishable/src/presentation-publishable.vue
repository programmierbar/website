<script>
import { useApi } from '@directus/extensions-sdk';
import { isPublishable } from './../../../extensions/shared/isPublishable.js';

export default {
  props: {
    collection: null,
    primaryKey: null,
  },
  data() {
    return {
      publishable: null,
    };
  },
  mounted() {
    Promise.all([
      this.loadItem(this.collection, this.primaryKey),
      this.loadFields(this.collection),
    ])
    .then(([itemResponse, fieldResponse]) => {
      const itemData = itemResponse.data.data;
      const fieldData = fieldResponse.data.data;

      let testResult = isPublishable(itemData, fieldData);

      this.publishable = testResult;
    })
    .catch(error => {
      console.error(error);
    });
  },
  methods: {
    loadItem: function(collection, primaryKey) {
      const api = useApi();
      const response = api.get(`/items/${collection}/${primaryKey}`);

      return response;
    },
    loadFields: function(collection) {
      const api = useApi();
      const response = api.get(`/fields/${collection}`);

      return response;
    },
  },
};
</script>

<template>
  <div v-if='publishable === true'>
    <v-icon name="check_circle" left />
    Can be published.
  </div>
  <div v-else-if='publishable === false'>
    <v-icon name="unpublished" left />
    Can not be published.
  </div>
  <div v-else-if='publishable === null'>
    <v-progress-circular indeterminate />
    Publishable state not yet determined...
  </div>
  <div v-else>
    <v-icon name="warning" left />
    Unknown publishable state. This should not happen and indicates an error.
  </div>
</template>
