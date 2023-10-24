<script>
import { useApi } from '@directus/extensions-sdk';
import { isPublishable } from './isPublishable.js';

export default {
  props: {
    collection: null,
    primaryKey: null,
    debug: true,
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
      // Access data from the first and second responses
      const itemData = itemResponse.data.data;
      const fieldData = fieldResponse.data.data;

      // Proceed with further processing using both data
      console.log('itemData data:', itemData);
      console.log('fieldData data:', fieldData);

      let testResult = isPublishable(itemData, fieldData);
      console.log('isPublishable', testResult);

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
  <p>Publishable: {{ publishable }}</p>
  <p>collection: {{ collection }}</p>
  <p>primaryKey: {{ primaryKey }}</p>
  <div v-if='publishable === true'>
    Can be published.
  </div>
  <div v-else-if='publishable === false'>
    Can not be published.
  </div>
  <div v-else-if='publishable === null'>
    Publishable state not yet determined...
  </div>
  <div v-else>
    Unknown publishable state. This should not happen and indicates an error.
  </div>
</template>
